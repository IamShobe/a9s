import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsECRRepository, AwsECRImage, ECRLevel, ECRRowMeta } from "./types.js";
import { createECRDetailCapability } from "./capabilities/detailCapability.js";
import { createECRYankCapability } from "./capabilities/yankCapability.js";
import { createECRActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface ECRNavFrame extends NavFrame {
  level: ECRLevel;
}

export const ecrLevelAtom = atom<ECRLevel>({ kind: "repositories" });
export const ecrBackStackAtom = atom<ECRNavFrame[]>([]);

function formatImageSize(bytes?: number): string {
  if (bytes == null) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createECRServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(ecrLevelAtom);
  const setLevel = (level: ECRLevel) => store.set(ecrLevelAtom, level);
  const getBackStack = () => store.get(ecrBackStackAtom);
  const setBackStack = (stack: ECRNavFrame[]) => store.set(ecrBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "repositories") {
      return [
        { key: "name", label: "Name" },
        { key: "uri", label: "URI" },
        { key: "scanOnPush", label: "Scan on Push", width: 14 },
        { key: "mutability", label: "Mutability", width: 12 },
        { key: "created", label: "Created", width: 12 },
      ];
    }
    // images level
    return [
      { key: "tag", label: "Tag", width: 30 },
      { key: "digest", label: "Digest", width: 20 },
      { key: "size", label: "Size", width: 10 },
      { key: "pushedAt", label: "Pushed At", width: 22 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "repositories") {
      try {
        const data = await runAwsJsonAsync<{ repositories: AwsECRRepository[] }>([
          "ecr",
          "describe-repositories",
          ...regionArgs,
        ]);
        return (data.repositories ?? []).map((repo) => ({
          id: repo.repositoryArn,
          cells: {
            name: textCell(repo.repositoryName),
            uri: textCell(repo.repositoryUri),
            scanOnPush: textCell(repo.imageScanningConfiguration?.scanOnPush ? "Yes" : "No"),
            mutability: textCell(repo.imageTagMutability ?? "-"),
            created: textCell(repo.createdAt ? repo.createdAt.slice(0, 10) : "-"),
          },
          meta: {
            type: "repository",
            repositoryName: repo.repositoryName,
            repositoryUri: repo.repositoryUri,
            repositoryArn: repo.repositoryArn,
          } satisfies ECRRowMeta,
        }));
      } catch (e) {
        debugLog("ecr", "getRows (repositories) failed", e);
        return [];
      }
    }

    // images level
    const { repositoryName, repositoryUri } = level;
    try {
      const data = await runAwsJsonAsync<{ imageDetails: AwsECRImage[] }>([
        "ecr",
        "describe-images",
        "--repository-name",
        repositoryName,
        ...regionArgs,
      ]);

      const rows: TableRow[] = [];
      for (const img of data.imageDetails ?? []) {
        const tags = img.imageTags ?? [];
        const shortDigest = img.imageDigest.slice(7, 19); // skip "sha256:" prefix, show 12 chars
        const pushedAt = img.imagePushedAt
          ? new Date(img.imagePushedAt).toISOString().slice(0, 19).replace("T", " ")
          : "-";

        if (tags.length === 0) {
          // Untagged image
          rows.push({
            id: img.imageDigest,
            cells: {
              tag: textCell("<untagged>"),
              digest: textCell(shortDigest),
              size: textCell(formatImageSize(img.imageSizeInBytes)),
              pushedAt: textCell(pushedAt),
            },
            meta: {
              type: "image",
              repositoryName,
              repositoryUri,
              imageDigest: img.imageDigest,
              imageTag: "",
            } satisfies ECRRowMeta,
          });
        } else {
          // One row per tag
          for (const tag of tags) {
            rows.push({
              id: `${img.imageDigest}:${tag}`,
              cells: {
                tag: textCell(tag),
                digest: textCell(shortDigest),
                size: textCell(formatImageSize(img.imageSizeInBytes)),
                pushedAt: textCell(pushedAt),
              },
              meta: {
                type: "image",
                repositoryName,
                repositoryUri,
                imageDigest: img.imageDigest,
                imageTag: tag,
              } satisfies ECRRowMeta,
            });
          }
        }
      }

      // Sort by pushedAt descending (newest first)
      rows.sort((a, b) =>
        (b.cells["pushedAt"]?.displayName ?? "").localeCompare(a.cells["pushedAt"]?.displayName ?? ""),
      );
      return rows;
    } catch (e) {
      debugLog("ecr", "getRows (images) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as ECRRowMeta | undefined;

    if (level.kind === "repositories") {
      if (!meta || meta.type !== "repository") return { action: "none" };
      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "images",
        repositoryName: meta.repositoryName,
        repositoryUri: meta.repositoryUri,
      });
      return { action: "navigate" };
    }

    // images level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "repositories") return "ecr://";
    return `ecr://${level.repositoryName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "repositories") return "📦 ECR Repositories";
    return `📦 ${level.repositoryName}`;
  };

  const detailCapability = createECRDetailCapability(region, getLevel);
  const yankCapability = createECRYankCapability();
  const actionCapability = createECRActionCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = region ?? "us-east-1";
    const meta = row.meta as ECRRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "repository") {
      return `https://${r}.console.aws.amazon.com/ecr/repositories/private/${meta.repositoryName}/?region=${r}`;
    }
    return null;
  };

  return {
    id: "ecr",
    label: "ECR",
    hudColor: SERVICE_COLORS.ecr ?? { bg: "blue", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "repositories" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
