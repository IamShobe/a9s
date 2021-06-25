# a9s

![](https://img.shields.io/github/v/release/IamShobe/a9s) ![](https://img.shields.io/github/workflow/status/IamShobe/a9s/Create%20and%20publish%20a%20Python%20package?label=pypi%20build) ![](https://img.shields.io/github/workflow/status/IamShobe/a9s/Create%20and%20publish%20a%20Docker%20image?label=docker%20build)  
Cli tool for easily navigating in AWS services.  
Highly inspired from [k9s](https://github.com/derailed/k9s). 


## How to install

```shell
pip install a9s
```

### Docker build

```shell
docker build . -t a9s
docker run -v ~/.aws/:/root/.aws -it --rm a9s
```

### Running docker from cloud

```shell
docker run -v ~/.aws/:/root/.aws -it --rm ghcr.io/iamshobe/a9s
```

## Goals

### Services
- [X] s3 support
- [X] route53 support
- [ ] EC2 support
- [ ] ELB support
- [ ] Cloudfront support


### Features
- [X] responsive tables
- [X] allow to easily switch between services
- [X] auto-complete commands
- [X] vim shortcuts support
- [X] opening files in S3
- [X] quick yank
- [ ] smart navigation between services - route53 pointing to ELB etc..
