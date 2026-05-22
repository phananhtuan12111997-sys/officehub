"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase/client"
import { CheckCircle2 } from "lucide-react"

interface PollViewerProps {
  poll: any
  currentUserId: string | undefined
  onVoteComplete?: () => void
}

export function PollViewer({ poll, currentUserId, onVoteComplete }: PollViewerProps) {
  const [voting, setVoting] = useState(false)

  if (!poll || !poll.poll_options) return null

  // Calculate total votes
  let totalVotes = 0
  const optionVotes: Record<string, number> = {}
  const myVotes = new Set<string>()

  poll.poll_options.forEach((opt: any) => {
    const votes = opt.poll_votes || []
    optionVotes[opt.id] = votes.length
    totalVotes += votes.length
    
    if (currentUserId && votes.some((v: any) => v.user_id === currentUserId)) {
      myVotes.add(opt.id)
    }
  })

  const hasVoted = myVotes.size > 0

  const handleVote = async (optionId: string) => {
    if (!currentUserId || voting) return
    
    setVoting(true)
    
    // Check if we need to remove previous vote for single choice
    if (!poll.is_multiple_choice && hasVoted && !myVotes.has(optionId)) {
      const prevOptionId = Array.from(myVotes)[0]
      await supabase.from('poll_votes').delete().eq('option_id', prevOptionId).eq('user_id', currentUserId)
    }

    // Toggle vote
    if (myVotes.has(optionId)) {
      await supabase.from('poll_votes').delete().eq('option_id', optionId).eq('user_id', currentUserId)
    } else {
      await supabase.from('poll_votes').insert({ option_id: optionId, user_id: currentUserId })
    }

    if (onVoteComplete) {
      onVoteComplete()
    }
    
    setVoting(false)
  }

  return (
    <div className="border rounded-xl p-4 md:p-6 bg-muted/10 my-4 shadow-sm border-primary/10">
      <h3 className="text-lg font-bold text-primary mb-1">{poll.question}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {poll.is_multiple_choice ? "Có thể chọn nhiều đáp án" : "Chỉ chọn 1 đáp án"} • {totalVotes} lượt bình chọn
      </p>

      <div className="space-y-3">
        {poll.poll_options.map((opt: any) => {
          const votes = optionVotes[opt.id] || 0
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
          const isSelected = myVotes.has(opt.id)

          return (
            <div key={opt.id} className="relative">
              <div 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors relative z-10 ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50 border-transparent bg-background'}`}
                onClick={() => handleVote(opt.id)}
              >
                <div className="flex items-center gap-2 font-medium z-10">
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  <span className={isSelected ? 'text-primary' : ''}>{opt.option_text}</span>
                </div>
                <div className="text-sm font-semibold z-10">
                  {percentage}% <span className="text-muted-foreground font-normal text-xs ml-1">({votes})</span>
                </div>
              </div>
              
              {/* Progress Bar Background */}
              {totalVotes > 0 && (
                <div className="absolute inset-0 rounded-lg overflow-hidden z-0 pointer-events-none border border-transparent">
                  <div 
                    className={`h-full opacity-20 transition-all duration-500 ease-in-out ${isSelected ? 'bg-primary' : 'bg-muted-foreground'}`} 
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
