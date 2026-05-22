"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Heart, ThumbsUp } from "lucide-react"

export const REACTION_TYPES = [
  { type: 'like', icon: '👍', label: 'Thích' },
  { type: 'love', icon: '❤️', label: 'Yêu thích' },
  { type: 'haha', icon: '😂', label: 'Haha' },
  { type: 'wow', icon: '😲', label: 'Wow' },
  { type: 'sad', icon: '😢', label: 'Buồn' },
  { type: 'angry', icon: '😡', label: 'Phẫn nộ' }
]

interface EmojiReactionsProps {
  postId: string
  reactions: any[]
  currentUserId: string | undefined
  onReact: (postId: string, type: string) => void
}

export function EmojiReactions({ postId, reactions, currentUserId, onReact }: EmojiReactionsProps) {
  const [open, setOpen] = useState(false)

  const myReaction = currentUserId ? reactions.find(r => r.user_id === currentUserId && r.reaction_type) : null
  const myReactionType = myReaction?.reaction_type

  const activeReaction = REACTION_TYPES.find(r => r.type === myReactionType)

  const handleReact = (type: string) => {
    onReact(postId, type)
    setOpen(false)
  }

  // Count top 3 reactions to show as summary
  const reactionCounts: Record<string, number> = {}
  reactions.forEach(r => {
    if (r.reaction_type) {
      reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1
    }
  })

  const topReactions = Object.entries(reactionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => REACTION_TYPES.find(r => r.type === entry[0])?.icon)
    .filter(Boolean)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger 
        className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
        title="Bày tỏ cảm xúc"
      >
          {activeReaction ? (
            <span className="text-lg hover:scale-125 transition-transform">{activeReaction.icon}</span>
          ) : (
            <Heart className="h-4 w-4 transition-transform hover:scale-125" />
          )}
          
          <div className="flex items-center gap-1">
            {topReactions.length > 0 && (
              <span className="flex -space-x-1">
                {topReactions.map((icon, idx) => (
                  <span key={idx} className="text-sm bg-background rounded-full">{icon}</span>
                ))}
              </span>
            )}
            <span className={activeReaction ? 'font-medium text-primary' : ''}>
              {reactions.length || 0}
            </span>
          </div>
      </PopoverTrigger>
      
      <PopoverContent side="top" align="start" className="w-auto p-2 bg-background border rounded-full shadow-lg">
        <div className="flex gap-2 items-center">
          {REACTION_TYPES.map(reaction => (
            <button
              key={reaction.type}
              onClick={(e) => {
                e.stopPropagation();
                handleReact(reaction.type);
              }}
              title={reaction.label}
              className={`text-2xl hover:scale-150 transition-transform duration-200 origin-bottom p-1 ${myReactionType === reaction.type ? 'bg-primary/20 rounded-full scale-125' : ''}`}
            >
              {reaction.icon}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
