import os
from setuptools import setup


# Utility function to read the README file.
# Used for the long_description.  It's nice, because now 1) we have a top level
# README file and 2) it's easier to type in the README file than to put a raw
# string in below ...
def read(fname):
    return open(os.path.join(os.path.dirname(__file__), fname)).read()


setup(
    name="a9s",
    version="0.1.0",
    author="Elran Shefer",
    author_email="elran777@gmail.com",
    description="Cli tool for navigation in Amazon AWS services. Highly inspired from k9s",
    license="MIT",
    keywords="aws cli",
    url="https://github.com/IamShobe/a9s",
    python_requires=">=3.6",
    entry_points={
      "console_scripts": ["a9s = a9s.main:main"],
    },
    packages=['a9s'],
    install_requires=[
        "blessed>=1.18.0",
        "colored>=1.4.2",
        "pyperclip>=1.8.2",
        "cached-property>=1.5.2",
        "boto3>=1.17.87",
        "attrdict>=2.0.1",
    ],
    long_description=read('README.md'),
    classifiers=[
        "Programming Language :: Python :: 3 :: Only",
        "Topic :: Utilities",
        "License :: OSI Approved :: MIT License",
        "Environment :: Console :: Curses",
    ],
)
