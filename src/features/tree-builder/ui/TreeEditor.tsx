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
  const [resourceType, setResourceType] = useState<'' | 'video' | 'article'>('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [resourceTitle, setResourceTitle] = useState('')

  const selectedNode = editor.nodes.find((n) => n.id === selectedNodeId)
  const isSelectedNodeBusy = selectedNodeId ? editor.busyIds.has(`node:${selectedNodeId}`) : false

  const handleNodeClick = (_e: React.MouseEvent, node: EditorNode) => {
    setSelectedEdgeId(null)
    setSelectedNodeId(node.id)
    setTitle(node.data.title)
    setDescription(node.data.description ?? '')
    setDifficulty(node.data.difficulty)
    // Ресурс в БД хранится массивом с одним элементом — заполняем поля из него.
    if (node.data.resourceType && node.data.resourceUrl) {
      setResourceType(node.data.resourceType)
      setResourceUrl(node.data.resourceUrl)
      setResourceTitle(node.data.resourceTitle ?? '')
    } else {
      setResourceType('')
      setResourceUrl('')
      setResourceTitle('')
    }
  }

  const handleSaveContent = async () => {
    if (!selectedNodeId) return
    // Все три ресурсных поля идут вместе: частично заполненный ресурс не сохраняем.
    const isResourceFilled = resourceType && resourceUrl.trim() && resourceTitle.trim()
    const hadResource = Boolean(selectedNode?.data.resourceType && selectedNode?.data.resourceUrl)
    const ok = await editor.saveNodeContent(selectedNodeId, {
      title,
      ...(description ? { description } : {}),
      difficulty,
      ...(isResourceFilled
        ? {
            resourceType,
            resourceUrl: resourceUrl.trim(),
            resourceTitle: resourceTitle.trim(),
          }
        : hadResource && !resourceType
          ? // Пользователь выбрал «Без ресурса» у узла с ресурсом — удаляем его.
            { clearResource: true }
          : {}),
    })
    if (ok) onChanged?.()
  }

  const handleDeleteSelectedNode = async () => {
    if (!selectedNodeId) return
    await editor.deleteNode(selectedNodeId)
    setSelectedNodeId(null)
    onChanged?.()
  }

  const handleDeleteSelectedEdge = async () => {
    if (!selectedEdgeId) return
    await editor.deleteEdge(selectedEdgeId)
    setSelectedEdgeId(null)
    onChanged?.()
  }

  const isInputClass =
    'w-full bg-gray-800 border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

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
                  maxLength={200}
                  className={isInputClass}
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание"
                  rows={2}
                  maxLength={1000}
                  className={isInputClass}
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

                {/* Ресурс: тип + URL + заголовок (сохраним только при заполнении всех полей). */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Ресурс (необязательно)</p>
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as '' | 'video' | 'article')}
                    className={isInputClass}
                  >
                    <option value="">Без ресурса</option>
                    <option value="video">Видео</option>
                    <option value="article">Статья</option>
                  </select>
                  {resourceType !== '' && (
                    <>
                      <input
                        value={resourceUrl}
                        onChange={(e) => setResourceUrl(e.target.value)}
                        placeholder="https://ссылка-на-ресурс"
                        type="url"
                        maxLength={500}
                        className={isInputClass}
                      />
                      <input
                        value={resourceTitle}
                        onChange={(e) => setResourceTitle(e.target.value)}
                        placeholder="Заголовок ресурса"
                        maxLength={200}
                        className={isInputClass}
                      />
                      {(resourceUrl.trim() || resourceTitle.trim()) &&
                        (!resourceUrl.trim() || !resourceTitle.trim()) && (
                          <p className="text-xs text-yellow-500">
                            Заполните и ссылку, и заголовок — иначе ресурс не сохранится.
                          </p>
                        )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleSaveContent()} disabled={isSelectedNodeBusy}>
                    {isSelectedNodeBusy ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Сохранить
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSelectedNodeBusy}
                    onClick={() => void handleDeleteSelectedNode()}
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
