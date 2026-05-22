"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

export interface PollData {
  question: string
  options: string[]
  is_multiple_choice: boolean
}

interface PollCreatorProps {
  data: PollData | null
  onChange: (data: PollData | null) => void
}

export function PollCreator({ data, onChange }: PollCreatorProps) {
  if (!data) return null

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...data.options]
    newOptions[index] = value
    onChange({ ...data, options: newOptions })
  }

  const addOption = () => {
    onChange({ ...data, options: [...data.options, ""] })
  }

  const removeOption = (index: number) => {
    const newOptions = data.options.filter((_, i) => i !== index)
    onChange({ ...data, options: newOptions })
  }

  return (
    <div className="border rounded-md p-4 bg-muted/30 space-y-4 mb-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold text-primary">Tạo Khảo Sát</Label>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="text-muted-foreground hover:text-red-500">
          <Trash2 className="h-4 w-4 mr-2" /> Xóa khảo sát
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Câu hỏi khảo sát</Label>
        <Input 
          placeholder="Bạn muốn hỏi gì?" 
          value={data.question}
          onChange={(e) => onChange({ ...data, question: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Các lựa chọn</Label>
        {data.options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input 
              placeholder={`Lựa chọn ${idx + 1}`}
              value={opt}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
            />
            {data.options.length > 2 && (
              <Button variant="ghost" size="icon" onClick={() => removeOption(idx)} className="text-muted-foreground hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addOption} className="w-full border-dashed">
        <Plus className="h-4 w-4 mr-2" /> Thêm lựa chọn
      </Button>

      <div className="flex items-center justify-between pt-2">
        <Label htmlFor="multiple-choice" className="cursor-pointer">Cho phép chọn nhiều đáp án</Label>
        <Switch 
          id="multiple-choice" 
          checked={data.is_multiple_choice} 
          onCheckedChange={(checked) => onChange({ ...data, is_multiple_choice: checked })}
        />
      </div>
    </div>
  )
}
