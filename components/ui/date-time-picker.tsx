"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  name?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  name,
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [timeStr, setTimeStr] = React.useState<string>(
    value ? format(value, "HH:mm") : "00:00"
  );

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) {
      setSelectedDate(undefined);
      onChange?.(undefined);
      return;
    }
    const [h, m] = timeStr.split(":").map(Number);
    const merged = new Date(day);
    merged.setHours(h ?? 0, m ?? 0, 0, 0);
    setSelectedDate(merged);
    onChange?.(merged);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    setTimeStr(t);
    if (selectedDate) {
      const [h, m] = t.split(":").map(Number);
      const merged = new Date(selectedDate);
      merged.setHours(h ?? 0, m ?? 0, 0, 0);
      setSelectedDate(merged);
      onChange?.(merged);
    }
  };

  const formattedValue = selectedDate
    ? format(selectedDate, "dd/MM/yyyy HH:mm")
    : "";

  const isoValue = selectedDate ? selectedDate.toISOString() : "";

  return (
    <>
      {name && <input type="hidden" name={name} value={isoValue} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {selectedDate ? formattedValue : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            initialFocus
          />
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time:</span>
              <Input
                type="time"
                value={timeStr}
                onChange={handleTimeChange}
                className="w-28 h-8 text-sm"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
