import Link from 'next/link'
import { Button } from '@/shared/ui/Button'

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-3xl">
          <div className="inline-block mb-6">
            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-green-500 bg-clip-text text-transparent">
              SkilLet
            </h1>
            <p className="text-xl text-gray-400">
              Интерактивная платформа для обучения в формате RPG skill-tree
            </p>
          </div>

          <p className="text-gray-500 mb-8 text-lg">
            Превратите обучение в увлекательную игру.
            Отмечайте навыки как пройденные, создавайте свои деревья и достигайте новых высот!
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Button size="lg" asChild>
              <Link href="/tree/new">Начать обучение</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/dashboard">Посмотреть деревья</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors">
              <h3 className="text-lg font-semibold mb-2">🎮 RPG система</h3>
              <p className="text-gray-400 text-sm">
                Отмечайте навыки как пройденные и прокачивайте свои деревья в формате RPG
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors">
              <h3 className="text-lg font-semibold mb-2">🌳 Skill Trees</h3>
              <p className="text-gray-400 text-sm">
                Создавайте собственные деревья навыков или используйте готовые от сообщества
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors">
              <h3 className="text-lg font-semibold mb-2">📱 Современный UI</h3>
              <p className="text-gray-400 text-sm">
                Адаптивный дизайн на Tailwind CSS с тёмной темой по умолчанию
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
