import { useState } from 'react';
import { Wrench, Graph, TreeStructure, CirclesThree } from '@phosphor-icons/react';
import { WidgetTile, WidgetPage } from './Widget';
import { ToolboxPage } from './Toolbox';
import { GraphPage } from './GraphWidget';
import { AgentsPage } from './AgentsWidget';
import { SwarmPage } from './SwarmWidget';
import ExecSummary from './ExecSummary';

// A run view = a menu of widget tiles. Click a tile → open its full page;
// Back returns to the menu. More widgets register here the same way.
const WIDGETS = [
  { id: 'swarm', title: 'Swarm', icon: CirclesThree, Page: SwarmPage },
  { id: 'toolbox', title: 'Toolbox', icon: Wrench, Page: ToolboxPage },
  { id: 'graph', title: 'Graph', icon: Graph, Page: GraphPage },
  { id: 'agents', title: 'Agents', icon: TreeStructure, Page: AgentsPage },
];

export default function RunView({ live = true, activeRun = null, summary = null }) {
  const [openId, setOpenId] = useState(null);
  const active = WIDGETS.find((w) => w.id === openId);

  if (active) {
    const Page = active.Page;
    return (
      <WidgetPage title={active.title} onBack={() => setOpenId(null)}>
        <Page live={live} activeRun={activeRun} summary={summary} />
      </WidgetPage>
    );
  }

  return (
    <div>
      {summary && <ExecSummary run={summary} />}
      <div className="flex flex-wrap gap-3">
        {WIDGETS.map((w) => (
          <WidgetTile key={w.id} icon={w.icon} title={w.title} onOpen={() => setOpenId(w.id)} />
        ))}
      </div>
    </div>
  );
}
