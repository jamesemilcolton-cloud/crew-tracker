import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus } from "lucide-react";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Candidate, CandidateSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";

const candidateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name too long"),
  phone: z.string().trim().max(20, "Phone number too long").default(""),
  source: z.enum(["LinkedIn", "Office"] as const, { required_error: "Source is required" }),
  notes: z.string().trim().max(2000, "Notes too long").default(""),
  potentialStartDate: z.date().optional(),
  droppedDuringOB: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (!data.droppedDuringOB && (!data.phone || data.phone.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Phone number is required",
      path: ["phone"],
    });
  }
});

type CandidateFormValues = z.infer<typeof candidateSchema>;

export interface AddCandidatePayload extends Omit<Candidate, "id" | "history" | "createdAt"> {
  droppedDuringOB?: boolean;
}

interface NewCandidateFormProps {
  onAdd: (candidate: AddCandidatePayload) => Promise<any>;
}

export function NewCandidateForm({ onAdd }: NewCandidateFormProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", notes: "", droppedDuringOB: false },
  });

  const droppedDuringOB = useWatch({ control: form.control, name: "droppedDuringOB" });

  async function onSubmit(data: CandidateFormValues) {
    await onAdd({
      name: `${data.firstName} ${data.lastName}`.trim(),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      notes: data.notes,
      source: data.source,
      stage: "obs",
      potentialStartDate: data.potentialStartDate ? data.potentialStartDate.toISOString().split("T")[0] : undefined,
      hasSalesPitchAccess: false,
      hasEvoAppAccess: false,
      droppedDuringOB: data.droppedDuringOB,
    });
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Candidate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="firstName" render={({ field }) => (
              <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="First name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="lastName" render={({ field }) => (
              <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Last name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number {droppedDuringOB && <span className="text-muted-foreground font-normal">(optional)</span>}</FormLabel>
                <FormControl><Input placeholder="+44 7000 000000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="source" render={({ field }) => (
              <FormItem><FormLabel>Source</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />

            {/* Dropped During OB toggle */}
            <FormField control={form.control} name="droppedDuringOB" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer">Dropped During OB</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    If checked, this candidate will be logged as an OB and immediately moved to Drop Off.
                  </FormDescription>
                </div>
              </FormItem>
            )} />

            {!droppedDuringOB && (
              <FormField control={form.control} name="potentialStartDate" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Potential Start Date</FormLabel>
                  <Popover><PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent></Popover><FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Interview notes, observations..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">{droppedDuringOB ? "Log OB & Drop" : "Add to Pipeline"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
