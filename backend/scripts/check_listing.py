import argparse
import asyncio
from app.services.freshness import check_listing_url


async def main():
    parser = argparse.ArgumentParser(description="Verify a permitted listing URL for stale/let-agreed status.")
    parser.add_argument("url")
    parser.add_argument("--selector")
    parser.add_argument("--means", choices=["let_agreed", "removed", "expired"])
    args = parser.parse_args()

    result = await check_listing_url(args.url, args.selector, args.means)
    print({
        "status": result.status.value,
        "archive": result.archive,
        "reason": result.reason,
        "checked_at": result.checked_at.isoformat(),
    })


if __name__ == "__main__":
    asyncio.run(main())
