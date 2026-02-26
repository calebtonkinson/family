"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import Link from "next/link";
import {
  useFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
} from "@/hooks/use-family-members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, CheckSquare, Check, X } from "lucide-react";

interface FamilyMemberPageProps {
  params: Promise<{ id: string }>;
}

export default function FamilyMemberPage({ params }: FamilyMemberPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: memberData, isLoading, error } = useFamilyMember(id);
  const updateMember = useUpdateFamilyMember();
  const deleteMember = useDeleteFamilyMember();

  const member = memberData?.data;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    birthday: "",
    gender: "",
  });

  useEffect(() => {
    if (!member) return;
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName || "",
      nickname: member.nickname || "",
      birthday: member.birthday || "",
      gender: member.gender || "",
    });
  }, [member]);

  const handleSave = async () => {
    if (!formData.firstName.trim()) {
      toast({
        title: "Error",
        description: "First name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMember.mutateAsync({
        id,
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName || undefined,
          nickname: formData.nickname || undefined,
          birthday: formData.birthday || undefined,
          gender: formData.gender
            ? (formData.gender as "male" | "female" | "other" | "prefer_not_to_say")
            : undefined,
        },
      });
      toast({ title: "Family member updated" });
      setIsEditing(false);
    } catch {
      toast({
        title: "Failed to update family member",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMember.mutateAsync(id);
      toast({ title: "Family member deleted" });
      router.push("/family");
    } catch {
      toast({
        title: "Failed to delete family member",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/family">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Family
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Family member not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${member.firstName[0]}${member.lastName?.[0] || ""}`;
  const displayName = member.nickname || `${member.firstName} ${member.lastName || ""}`.trim();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/family">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Family
          </Link>
        </Button>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete family member?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {displayName}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Family Member" : "Family Member"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthday">Birthday</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={updateMember.isPending}>
                  <Check className="mr-2 h-4 w-4" />
                  {updateMember.isPending ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={member.avatarUrl || undefined} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  {member.nickname && (
                    <p className="text-sm text-muted-foreground">
                      {member.firstName} {member.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <CheckSquare className="h-3 w-3" />
                  {member.assignedTaskCount || 0} open tasks
                </Badge>
                {member.birthday && (
                  <Badge variant="outline">Birthday: {member.birthday}</Badge>
                )}
                {member.gender && (
                  <Badge variant="outline">Gender: {member.gender.replaceAll("_", " ")}</Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
