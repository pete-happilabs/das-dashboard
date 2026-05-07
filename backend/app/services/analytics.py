from collections import Counter


def build_analytics(documents: list[dict]) -> dict:
    by_type = Counter(d.get("entity_type") or "other" for d in documents)
    tags = Counter(tag for d in documents for tag in d.get("tags", []))
    locations = Counter(loc for d in documents for loc in d.get("locations", []))
    owners = Counter(d.get("owner") or "unknown" for d in documents)
    rep = Counter(str(d.get("reputation") or "unrated") for d in documents)

    media = {
        "images": sum(bool(d.get("imageUrls")) for d in documents),
        "videos": sum(bool(d.get("videoUrls")) for d in documents),
        "audio": sum(bool(d.get("audioUrls")) for d in documents),
        "documents": sum(bool(d.get("documentUrls")) for d in documents),
    }
    total = len(documents)
    return {
        "total": total,
        "by_type": {"person": by_type["person"], "business": by_type["business"], "other": by_type["other"]},
        "completeness": {
            "with_tags": sum(bool(d.get("tags")) for d in documents),
            "with_location": sum(bool(d.get("locations")) for d in documents),
            "with_media": sum(any(d.get(k) for k in ["imageUrls", "videoUrls", "audioUrls", "documentUrls"]) for d in documents),
            "with_reputation": sum(bool(d.get("reputation")) for d in documents),
        },
        "top_tags": [{"tag": tag, "count": count} for tag, count in tags.most_common(20)],
        "top_locations": [{"location": loc, "count": count} for loc, count in locations.most_common(10)],
        "reputation_distribution": {str(i): rep[str(i)] for i in range(1, 6)} | {"unrated": rep["unrated"]},
        "media_coverage": media,
        "top_owners": [{"owner": owner, "count": count} for owner, count in owners.most_common(10)],
        "documents": documents,
    }
