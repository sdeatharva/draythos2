"""Vhagar entry point. Run with: python -m vhagar"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description="Draythos Vhagar backend")
    parser.add_argument("--single-process", action="store_true", help="Run UI and MCP in a single process")
    parser.add_argument("--ui-port", type=int, default=8000, help="UI server port")
    parser.add_argument("--mcp-port", type=int, default=8001, help="MCP server port")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Bind host")
    args = parser.parse_args()

    from vhagar.server_runners import run_all, run_single_process

    if args.single_process:
        run_single_process(host=args.host, port=args.ui_port)
    else:
        run_all(host=args.host, ui_port=args.ui_port, mcp_port=args.mcp_port)


if __name__ == "__main__":
    main()

