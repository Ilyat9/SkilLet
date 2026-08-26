'use client'

import { useState } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel } from '@xyflow/react'
import { useTreeEditor, type EditorNode, type EditorEdge } from '@/features/tree-builder/model/useTreeEditor'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Loader2, Plus, Trash2, Save, Eye } from 'lucide-react'

interface TreeEditorProps {
  treeId: string
  initialNodes: EditorNode[]
  initialEdges: EditorEdge[]
  onExit: () => void
  onChanged?: () => void
}

function TreeEditorInner({ treeId, initialNodes, initialEdges, onExit, onChanged }: TreeEditorProps) {
  const editor = useTreeEditor({ treeId, initialNodes, initialEdges })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState(1)

  const selectedNode = editor.nodes.find((n) => n.id === selectedNodeId)

  const handleNodeClick = (_e: React.MouseEvent, node: EditorNode) => {
    setSelectedEdgeId(null)
    setSelectedNodeId(node.id)
    setTitle(node.data.title)
    setDescription(node.data.description ?? '')
    setDifficulty(node.data.difficulty)
  }

  const handleSaveContent = async () => {
    if (!selectedNodeId) return
    const ok = await editor.saveNodeContent(selectedNodeId, {
      title,
      ...(description ? { description } : {}),
      difficulty,
    })
    if (ok) onChanged?.()
  }

  const handleDeleteSelectedEdge = async () => {
    if (!selectedEdgeId) return
    await editor.deleteEdge(selectedEdgeId)
    setSelectedEdgeId(null)
    onChanged?.()
  }

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={editor.nodes}
        edges={editor.edges}
        onNodesChange={editor.onNodesChange}
        onEdgesChange={editor.onEdgesChange}
        onConnect={(c) => {
          void editor.onConnect(c).then(() => onChanged?.())
        }}
        onNodeClick={handleNodeClick}
        onEdgeClick={(_e, edge) => {
          setSelectedNodeId(null)
          setSelectedEdgeId(edge.id)
        }}
        onNodeDragStop={(_e, node) =>
          void editor.saveNodePosition(node.id, Math.round(node.position.x), Math.round(node.position.y))
        }
        fitView
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>


      <Panel position="top-left" className="!m-3 flex flex-col gap-2 items-start">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void editor.addNode({ x: 0, y: 0 }).then(() => onChanged?.())} disabled={editor.isLoading}>
            <Plus className="w-4 h-4 mr-1" />
            Добавить узел
          </Button>
          <Button size="sm" variant="ghost" onClick={editor.fitView}>
            Вписать
          </Button>
          <Button size="sm" variant="secondary" onClick={onExit}>
            <Eye className="w-4 h-4 mr-1" />
            Режим просмотра
          </Button>
        </div>
        {editor.error && <Badge variant="error">{editor.error}</Badge>}
      </Panel>

      {(selectedNode || selectedEdgeId) && (
        <Panel position="top-right" className="!m-3 w-72">
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg space-y-3">
            {selectedNode && (
              <>
                <h3 className="font-semibold text-sm">Редактирование узла</h3>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название"
                  className="w-full bg-gray-800 border border-border rounded px-2 py-1.5 text-sm"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание"
                  rows={2}
                  className="w-full bg-gray-800 border border-border rounded px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  Сложность:
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                  />
                  <span className="text-foreground">{difficulty}/10</span>
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleSaveContent()} disabled={editor.isLoading}>
                    <Save className="w-4 h-4 mr-1" />
                    Сохранить
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void editor.deleteNode(selectedNodeId ?? '').then(() => {
                        setSelectedNodeId(null)
                        onChanged?.()
                      })
                    }
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Удалить
                  </Button>
                </div>
              </>
            )}
            {selectedEdgeId && (
              <>
                <h3 className="font-semibold text-sm">Связь выбрана</h3>
                <Button size="sm" variant="secondary" onClick={() => void handleDeleteSelectedEdge()}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Удалить связь
                </Button>
              </>
            )}
          </div>
        </Panel>
      )}

      {editor.isLoading && (
        <div className="absolute bottom-4 right-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

// useReactFlow требует контекста провайдера — оборачиваем внутренний компонент.
export function TreeEditor(props: TreeEditorProps) {
  return (
    <ReactFlowProvider>
      <TreeEditorInner {...props} />
    </ReactFlowProvider>
  )
}
