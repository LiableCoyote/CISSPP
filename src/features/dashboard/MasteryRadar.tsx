import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export type RadarDatum = { domain: string; mastery: number; weight: number };

/**
 * Split out and lazy-loaded from DashboardPage. Recharts' polar bundle is ~97KB
 * over the wire and the dashboard is the landing page — deferring it keeps the
 * first screen lean for users whose radar is empty anyway.
 */
export default function MasteryRadar({ data }: { data: RadarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#243046" />
        <PolarAngleAxis dataKey="domain" stroke="#8b97ab" fontSize={11} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} stroke="#243046" />
        <Radar dataKey="mastery" fill="#6ee7b7" fillOpacity={0.3} stroke="#6ee7b7" strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
