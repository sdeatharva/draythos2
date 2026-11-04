"""Setup script for the Vhagar document intelligence engine."""

from pathlib import Path

from setuptools import find_packages, setup

ROOT = Path(__file__).parent

requirements: list[str] = []
req_file = ROOT / "requirements.txt"
if req_file.exists():
    requirements = [
        line.strip()
        for line in req_file.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="vhagar",
    version="0.1.0",
    description="Vhagar — Document intelligence engine for Draythos",
    author="Draythos Team",
    python_requires=">=3.10",
    packages=find_packages(include=["vhagar", "vhagar.*"]),
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "vhagar=vhagar.__main__:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
)
