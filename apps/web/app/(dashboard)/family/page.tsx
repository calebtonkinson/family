"use client";

import { useFamilyMembers } from "@/hooks/use-family-members";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckSquare } from "lucide-react";
import Link from "next/link";

export default function FamilyPage() {
  const { data: familyData, isLoading } = useFamilyMembers();
  const members = familyData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Members</h1>
        <Button asChild>
          <Link href="/family/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Member
          </Link>
        </Button>
      </div>

      {/* Member Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : members.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const initials = `${member.firstName[0]}${member.lastName?.[0] || ""}`;
            const displayName = member.nickname || `${member.firstName} ${member.lastName || ""}`.trim();

            return (
              <Link key={member.id} href={`/family/${member.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold">{displayName}</h3>
                      {member.nickname && (
                        <p className="text-sm text-muted-foreground">
                          {member.firstName} {member.lastName}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckSquare className="h-3 w-3" />
                        {member.assignedTaskCount || 0} open tasks
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No family members found. Add your first family member to get started.
        </div>
      )}
    </div>
  );
}
