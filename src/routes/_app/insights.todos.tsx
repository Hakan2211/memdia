/**
 * Todos Tab
 * Manage todos extracted from reflections + manual creation
 */

import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckSquare, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createTodoFn,
  deleteTodoFn,
  getTodosFn,
  updateTodoFn,
} from '../../server/insights.fn'
import { TodoItem } from '../../components/insights/todo-item'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/_app/insights/todos')({
  component: TodosTab,
})

function TodosTab() {
  const queryClient = useQueryClient()
  const [newTodoText, setNewTodoText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)

  const { data: todos, isLoading } = useQuery({
    queryKey: ['insights', 'todos'],
    queryFn: () => getTodosFn(),
  })

  const createMutation = useMutation({
    mutationFn: (text: string) => createTodoFn({ data: { text } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'todos'] })
      queryClient.invalidateQueries({ queryKey: ['insights', 'overview'] })
      setNewTodoText('')
      toast.success('Todo created')
    },
    onError: () => {
      toast.error('Failed to create todo')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; completed: boolean }) =>
      updateTodoFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'todos'] })
      queryClient.invalidateQueries({ queryKey: ['insights', 'overview'] })
    },
    onError: () => {
      toast.error('Failed to update todo')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTodoFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights', 'todos'] })
      queryClient.invalidateQueries({ queryKey: ['insights', 'overview'] })
      toast.success('Todo deleted')
    },
    onError: () => {
      toast.error('Failed to delete todo')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTodoText.trim()) {
      createMutation.mutate(newTodoText.trim())
    }
  }

  const handleToggle = (id: string, completed: boolean) => {
    updateMutation.mutate({ id, completed })
  }

  const pendingTodos = todos?.filter((t) => !t.completed) || []
  const completedTodos = todos?.filter((t) => t.completed) || []

  if (isLoading) {
    return <TodosSkeleton />
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Add Todo Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Add Todo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="What do you need to do?"
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!newTodoText.trim() || createMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending Todos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">
              Pending ({pendingTodos.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {pendingTodos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>All caught up! No pending todos.</p>
            </div>
          ) : (
            <div className="divide-y">
              {pendingTodos.map((todo) => (
                <div key={todo.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <TodoItem
                      id={todo.id}
                      text={todo.text}
                      completed={todo.completed}
                      priority={todo.priority}
                      dueDate={todo.dueDate}
                      context={todo.context}
                      onToggle={handleToggle}
                      showContext
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(todo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Todos */}
      {completedTodos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">
                Completed ({completedTodos.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showCompleted && (
            <CardContent className="pt-0">
              <div className="divide-y">
                {completedTodos.map((todo) => (
                  <div key={todo.id} className="flex items-start gap-2">
                    <div className="flex-1">
                      <TodoItem
                        id={todo.id}
                        text={todo.text}
                        completed={todo.completed}
                        priority={todo.priority}
                        dueDate={todo.dueDate}
                        context={todo.context}
                        onToggle={handleToggle}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(todo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

function TodosSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Skeleton className="h-[120px] rounded-lg" />
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  )
}
