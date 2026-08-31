"""Dump the FalkorDB `bastion` cortex as force-graph triples (Global mode)."""
import json
from falkordb import FalkorDB

g = FalkorDB(host="localhost", port=6379).select_graph("bastion")
rows = g.query(
    "MATCH (a)-[r]->(b) RETURN labels(a)[0], a.name, type(r), labels(b)[0], b.name"
).result_set

# entity types whose head/tail decide the provenance ring; everything renders.
FINDING_TYPES = {"Finding"}
triples = []
for la, na, rel, lb, nb in rows:
    if not na or not nb:
        continue
    # keep labels reasonable
    na, nb = str(na)[:80], str(nb)[:80]
    src = "finding" if (la in FINDING_TYPES or lb in FINDING_TYPES) else "log"
    triples.append({"h": f"{la}:{na}", "r": rel, "t": f"{lb}:{nb}", "source": src})

print(json.dumps({"triples": triples, "count": len(triples)}))
