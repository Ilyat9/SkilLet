import Link from 'next/link'
import { Button } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-3xl">
          <div className="inline-block mb-6">
            <Logo className="h-12 w-12 mx-auto mb-4" />
            <h1 className="text-6xl mb-4">SkilLet</h1>
            <p className="text-xl text-muted-foreground">
              Деревья навыков: планируйте обучение и отмечайте пройденное
            </p>
          </div>

          <p className="text-text-tertiary mb-8 text-lg">
            Постройте маршрут из навыков, где следующий открывается после
            предыдущего. Начните с готового дерева из каталога или нарисуйте своё.
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Button size="lg" asChild>
              <Link href="/tree/new">Создать дерево</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/explore">Открыть каталог</Link>
            </Button>
          </div>

          <div className="text-left max-w-xl mx-auto divide-y divide-border">
            <div className="py-5">
              <h3 className="text-lg font-semibold mb-1">Зависимости вместо галочек</h3>
              <p className="text-muted-foreground text-sm">
                Узлы связаны между собой: пока основа не пройдена, продолжение остаётся
                недоступным. Прогресс виден на графе целиком.
              </p>
            </div>

            <div className="py-5">
              <h3 className="text-lg font-semibold mb-1">Каталог сообщества</h3>
              <p className="text-muted-foreground text-sm">
                Готовые деревья по frontend, backend, design и другим разделам.
                Любое публичное дерево можно форкнуть и переделать под себя.
              </p>
            </div>

            <div className="py-5">
              <h3 className="text-lg font-semibold mb-1">Серия дней и достижения</h3>
              <p className="text-muted-foreground text-sm">
                Streak растёт, пока вы отмечаете узлы хотя бы раз в день; за вехи
                выдаются достижения.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
