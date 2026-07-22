import React from "react"
import { Card } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

export function StatsCard({ title, value, icon, color }: StatsCardProps) {
  return (
    <Card className="p-6 border-border bg-card">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
    </Card>
  );
}
