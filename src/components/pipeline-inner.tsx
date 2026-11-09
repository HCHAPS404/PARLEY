"use client";

import "@bryntum/gantt-enterprise/gantt.css";
import "@bryntum/gantt-enterprise/svalbard.css";
import { BryntumGantt } from "@bryntum/gantt-react-enterprise";
import { usePrefs } from "./preferences";
import type { I18nKey } from "@/lib/i18n";

export type PipelineTask = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  percentDone: number;
  status: string;
  cls?: string;
};

const STATUS_LABEL: Record<string, string> = {
  created: "Created",
  approved: "Approved",
  authorized: "In escrow",
  unpaid: "Awaiting approval",
  captured: "Released",
  voided: "Voided",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function PipelineInner({ tasks }: { tasks: PipelineTask[] }) {
  const { t } = usePrefs();
  if (!tasks.length) {
    return (
      <div className="grid h-full w-full place-items-center text-[13px] text-ink-soft">
        No escrow orders yet — they appear here as the agent creates them.
      </div>
    );
  }
  const dates = tasks.flatMap((t) => [
    Date.parse(t.startDate),
    Date.parse(t.endDate),
  ]);
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));

  const legend: { cls: string; label: I18nKey }[] = [
    { cls: "bg-accent", label: "pipe.legend.escrow" },
    { cls: "bg-danger", label: "pipe.legend.overdue" },
    { cls: "bg-ok", label: "pipe.legend.captured" },
    { cls: "bg-ink-soft/40", label: "pipe.legend.voided" },
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        {legend.map(({ cls, label }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 text-[11px] text-ink-soft"
          >
            <span className={`h-2 w-2 rounded-sm ${cls}`} />
            {t(label)}
          </span>
        ))}
      </div>
      <div className="parley-gantt min-h-0 flex-1">
        <BryntumGantt
          project={{ tasksData: tasks }}
          startDate={min}
          endDate={max}
          projectLinesFeature={false}
          taskTooltipFeature={false}
          taskEditFeature={false}
          taskDragFeature={false}
          taskResizeFeature={false}
          taskMenuFeature={false}
          cellEditFeature={false}
          columnDragToolbarFeature={false}
          dependenciesFeature={false}
          columns={[
            { type: "name", text: t("pipe.col.order"), width: 300 },
            { type: "percentdone", text: t("pipe.col.progress"), width: 90 },
            { type: "startdate", text: t("pipe.col.created"), width: 110 },
            { type: "enddate", text: t("pipe.col.delivery"), width: 110 },
            {
              field: "status",
              text: t("dash.col.status"),
              width: 130,
              renderer: ({ value }: { value: string }) => ({
                tag: "span",
                class: `pipe-status pipe-status-${value}`,
                text: STATUS_LABEL[value] ?? value,
              }),
            },
          ]}
          rowHeight={38}
          barMargin={8}
        />
      </div>
    </div>
  );
}
