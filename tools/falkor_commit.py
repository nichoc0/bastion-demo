"""Feed the important nodes of a finished assessment back into the FalkorDB
`bastion` cortex. Reads {nodes:[{label,kind,detail}], edges:[{h,r,t}]} on stdin
and MERGEs by name (idempotent), tagged source='clip-assessment'."""
import json
import sys
from falkordb import FalkorDB

payload = json.load(sys.stdin)
g = FalkorDB(host="localhost", port=6379).select_graph("bastion")

def label_for(kind):
    return {
        "endpoint": "Endpoint",
        "finding": "Finding",
        "credential": "Finding",
        "openport": "Endpoint",
        "vuln": "Finding",
        "jailbreak": "Finding",
    }.get(kind, "AssessmentNode")

merged = 0
for n in payload.get("nodes", []):
    lbl = label_for(n.get("kind"))
    g.query(
        f"MERGE (x:{lbl} {{name:$name}}) "
        "SET x.source='clip-assessment', x.detail=$detail, x.kind=$kind",
        {"name": n["label"], "detail": n.get("detail", ""), "kind": n.get("kind", "")},
    )
    merged += 1

linked = 0
for e in payload.get("edges", []):
    g.query(
        "MATCH (a {name:$h}), (b {name:$t}) MERGE (a)-[r:ASSESSMENT_REL {rel:$r}]->(b)",
        {"h": e["h"], "t": e["t"], "r": e.get("r", "related")},
    )
    linked += 1

print(json.dumps({"merged": merged, "linked": linked}))
