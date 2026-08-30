import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
}

/**
 * Политика конфиденциальности. Статическая страница без метафоры:
 * юридический текст должен быть скучным и точным.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <h1 className="text-3xl mb-6">Политика конфиденциальности</h1>

        <div className="space-y-5 text-sm leading-relaxed text-text-secondary">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Какие данные собираются</h2>
            <p>
              Вход выполняется через GitHub OAuth. При первом входе сохраняются имя пользователя,
              адрес электронной почты и аватар из профиля GitHub. Дополнительно сохраняется всё,
              что вы создаёте сами: деревья навыков, узлы, отметки прогресса, комментарии и лайки.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Как данные используются</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>профиль нужен для отображения вашего имени и аватара в интерфейсе;</li>
              <li>деревья и прогресс работают так, как вы их создаёте и отмечаете;</li>
              <li>достижения и серия дней считаются на сервере на основе отметок прогресса;</li>
              <li>тема оформления хранится только в localStorage вашего браузера.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Что не собирается</h2>
            <p>
              Нет рекламных трекеров и систем веб-аналитики. Файлы cookie используются только
              для поддержания сессии входа. Ошибки приложения могут попадать в серверные логи
              вместе с идентификатором запроса; личные сообщения и переписку сервис не хранит.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Удаление данных</h2>
            <p>
              Свои деревья вы можете удалить из интерфейса. Чтобы удалить аккаунт и связанные
              с ним данные, напишите на почту из раздела «Автор» в README проекта.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}