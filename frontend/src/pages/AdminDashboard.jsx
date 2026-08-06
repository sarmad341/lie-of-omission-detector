import { useEffect, useState } from "react";
import { adminGetAnalytics } from "../api";
import {
  FileText, Clock, CheckCircle2, XCircle, Loader2,
  TrendingUp, Award, Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function StatCard({ label, value, color, sublabel, icon }) {
  return (
    <Card className="relative p-0" style={{ borderTop: `4px solid ${color}` }}>
      <div style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{label}</div>
            {sublabel && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{sublabel}</div>}
          </div>
          {icon && (
            <div style={{ padding: 8, borderRadius: 8, background: `${color}15`, color }}>{icon}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await adminGetAnalytics();
        setAnalytics(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full rounded-xl md:col-span-2" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">Analytics Dashboard</h2>
        <p className="text-gray-500 mt-1">High-level metrics for {analytics?.company_name || "your company"}.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analytics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Applications"
              value={analytics.total_applications}
              color="var(--primary)"
              icon={<FileText size={24} />}
            />
            <StatCard
              label="Pending Review"
              value={analytics.pending_review}
              color="#3b82f6"
              icon={<Clock size={24} />}
            />
            <StatCard
              label="Approved"
              value={analytics.approved}
              color="var(--status-supported-text)"
              icon={<CheckCircle2 size={24} />}
            />
            <StatCard
              label="Denied"
              value={analytics.denied}
              color="var(--status-contradicted-text)"
              icon={<XCircle size={24} />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Application Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    count: { label: "Applications" },
                    Approved: { label: "Approved", color: "#22c55e" },
                    Denied: { label: "Denied", color: "#ef4444" },
                    Pending: { label: "Pending Review", color: "#3b82f6" },
                    Awaiting: { label: "Awaiting Info", color: "#ec4899" },
                  }}
                  className="h-[250px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { status: "Approved", count: analytics.approved, fill: "var(--color-Approved)" },
                        { status: "Denied", count: analytics.denied, fill: "var(--color-Denied)" },
                        { status: "Pending", count: analytics.pending_review, fill: "var(--color-Pending)" },
                        { status: "Awaiting", count: analytics.sent_back_for_more_evidence || 0, fill: "var(--color-Awaiting)" },
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={10} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="p-6 flex flex-col justify-center items-center text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <Award className="w-12 h-12 text-primary mb-4" />
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {analytics.total_applications > 0 
                  ? Math.round((analytics.approved / analytics.total_applications) * 100) 
                  : 0}%
              </div>
              <div className="text-sm font-medium text-gray-500">Approval Rate</div>
              <div className="mt-4 px-4 py-1.5 bg-white rounded-full text-xs font-semibold text-primary shadow-sm border border-primary/10">
                <TrendingUp size={12} className="inline mr-1" />
                Performing well
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
