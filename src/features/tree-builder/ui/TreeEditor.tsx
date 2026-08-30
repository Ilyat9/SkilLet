'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useOnSelectionChange,
  type Connection,
} from '@xyflow/react'
import { useTreeEditor, type EditorNode, type EditorEdge } from '@/features/tree-builder/model/useTreeEditor'
import { EditorNodeView } from './EditorNodeView'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { Modal } from '@/shared/ui/Modal'
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

  // Индикатор «Сохранено»: показывается на 2с после успешной мутации.
  const [showSaved, setShowSaved] = useState(false)
  const wasLoadingRef = useRef(false)
  // Подтверждение удаления узла: операция необратима и каскадно стирает
  // связи и прогресс — требуем явного подтверждения (hard-delete по дизайну).
  const [isDeleteNodeConfirmOpen, setIsDeleteNodeConfirmOpen] = useState(false)
  useEffect(() => {
    if (wasLoadingRef.current && !editor.isLoading && !editor.error) {
      setShowSaved(true)
      const timer = window.setTimeout(() => setShowSaved(false), 2000)
      return () => window.clearTimeout(timer)
    }
    wasLoadingRef.current = editor.isLoading
  }, [editor.isLoading, editor.error])

  const selectedNode = editor.nodes.find((n) => n.id === selectedNodeId)
  const isSelectedNodeBusy = selectedNodeId ? editor.busyIds.has(`node:${selectedNodeId}`) : false

  // Заполняет панель редактирования данными выбранного узла.
  const fillNodeForm = useCallback((node: EditorNode) => {
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
  }, [])

  // Правило кода: обработчики React Flow — через хуки, а не inline-функции
  // в JSX-пропах. Выделение узла/ребра обрабатывается хуком useOnSelectionChange.
  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const firstNode = selectedNodes[0] as EditorNode | undefined
      const firstEdge = selectedEdges[0]
      if (firstNode) {
        setSelectedEdgeId(null)
        setSelectedNodeId(firstNode.id)
        fillNodeForm(firstNode)
      } else if (firstEdge) {
        setSelectedNodeId(null)
        setSelectedEdgeId(firstEdge.id)
      }
    },
  })

  // onConnect / onNodeDragStop — стабильные колбэки вместо inline-функций.
  const handleConnect = useCallback(
    (connection: Connection) => {
      void editor.onConnect(connection).then(() => onChanged?.())
    },
    [editor, onChanged]
  )

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: EditorNode) => {
      void editor.saveNodePosition(node.id, Math.round(node.position.x), Math.round(node.position.y))
    },
    [editor]
  )

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: EditorNode) => {
    setSelectedEdgeId(null)
    setSelectedNodeId(node.id)
    fillNodeForm(node)
  }, [fillNodeForm])

  const handleEdgeClick = useCallback((_e: React.MouseEvent, edge: EditorEdge) => {
    setSelectedNodeId(null)
    setSelectedEdgeId(edge.id)
  }, [])

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
    setIsDeleteNodeConfirmOpen(false)
    await editor.deleteNode(selectedNodeId)
    setSelectedNodeId(null)
    onChanged?.()
  }

  // Сколько связей удалится вместе с узлом (рёбра удаляются каскадно).
  const deleteNodeEdgeCount = selectedNodeId
    ? editor.edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId).length
    : 0

  const handleDeleteSelectedEdge = async () => {
    if (!selectedEdgeId) return
    await editor.deleteEdge(selectedEdgeId)
    setSelectedEdgeId(null)
    onChanged?.()
  }

  const isInputClass =
    'w-full bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

  // Все узлы редактора рендерятся кастомной карточкой (EditorNodeView):
  // без явного nodeTypes ReactFlow рисует дефолтные белые прямоугольники.
  const nodeTypes = useMemo(() => ({ editor: EditorNodeView }), [])
  const styledNodes = useMemo(
    () => editor.nodes.map((n) => (n.type === 'editor' ? n : ({ ...n, type: 'editor' } as EditorNode))),
    [editor.nodes]
  )

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={styledNodes}
        edges={editor.edges}
        nodeTypes={nodeTypes}
        onNodesChange={editor.onNodesChange}
        onEdgesChange={editor.onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onNodeDragStop={handleNodeDragStop}
        fitView
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background />
        {/* Без props MiniMap рендерится в дефолтной светлой теме ReactFlow
            (белая заливка) — на тёмной теме выглядит как белый артефакт.
            Стилизация как в SkillTreeViewer. */}
        <MiniMap
          pannable
          zoomable
          style={{ width: 112, height: 72 }}
          bgColor="hsl(var(--card))"
          nodeColor="hsl(var(--muted))"
          nodeStrokeColor="hsl(var(--border))"
          maskColor="hsl(var(--background) / 0.75)"
        />
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
        {/* Ненавязчивый индикатор фонового сохранения рядом с тулбаром. */}
        {editor.isLoading && <Badge variant="default">Сохранение…</Badge>}
        {!editor.isLoading && showSaved && (
          <Badge variant="success" className="animate-toast-in">
            Сохранено
          </Badge>
        )}
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
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  <p className="text-xs text-muted-foreground font-medium">Ресурс (необязательно)</p>
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
                          <p className="text-xs text-accent-strong">
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
                    onClick={() => setIsDeleteNodeConfirmOpen(true)}
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

      {/* Подтверждение удаления узла с явным перечислением каскадных последствий. */}
      <Modal
        isOpen={isDeleteNodeConfirmOpen && Boolean(selectedNodeId)}
        onClose={() => setIsDeleteNodeConfirmOpen(false)}
        title="Удалить навык?"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Навык <span className="font-semibold text-foreground">«{selectedNode?.data.title}»</span> будет
          удалён безвозвратно. Вместе с ним удалятся:
        </p>
        <ul className="text-sm list-disc pl-5 mb-4 space-y-1">
          <li>
            связей с другими навыками: <span className="font-semibold">{deleteNodeEdgeCount}</span>
          </li>
          <li>все отметки прогресса по этому навыку у всех пользователей</li>
        </ul>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setIsDeleteNodeConfirmOpen(false)}>
            Отмена
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void handleDeleteSelectedNode()}>
            <Trash2 className="w-4 h-4 mr-1" />
            Удалить безвозвратно
          </Button>
        </div>
      </Modal>
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
