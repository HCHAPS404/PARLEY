"use client";

import "@bryntum/gantt-enterprise/gantt.css";
import "@bryntum/gantt-enterprise/svalbard.css";
import { BryntumGantt } from "@bryntum/gantt-react-enterprise";

export type PipelineTask = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  percentDone: number;
  status: string;
  cls?: string;
};

export default function PipelineInner({ tasks }: { tasks: PipelineTask[] }) {
  const dates = tasks.flatMap((t) => [Date.parse(t.startDate), Date.parse(t.endDate)]);
  const min = dates.length ? new Date(Math.min(...dates)) : new Date();
  const max = dates.length ? new Date(Math.max(...dates)) : new Date(Date.now() + 7 * 86_400_000);

  return (
    <div className="h-full w-full">
      <BryntumGantt
        project={{ tasksData: tasks }}
        startDate={min}
        endDate={max}
        columns={[
          { type: "name", text: "Escrow order", width: 320 },
          { type: "percentdone", text: "%", width: 70 },
          { type: "startdate", text: "Created", width: 110 },
          { type: "enddate", text: "Expected/delivered", width: 140 },
        ]}
        rowHeight={38}
        barMargin={8}
      />
    </div>
  );
}
