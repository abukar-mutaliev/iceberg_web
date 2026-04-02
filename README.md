# Панель поставщика (Supplier Portal)

Веб-приложение для поставщиков платформы Iceberg: каталог товаров, модерация, возвраты, отзывы, профиль.

## Стек

- React 18, TypeScript
- Vite
- React Router v6, TanStack Query
- Ant Design, React Hook Form, Zod
- Zustand (при необходимости)
- Архитектура: **Feature-Sliced Design (FSD)**

## Запуск

```bash
npm install
cp .env.example .env   # задать VITE_API_BASE_URL (адрес бэкенда)
npm run dev
```

Сборка: `npm run build`.

## Структура (FSD)

```
src/
  app/                 # Инициализация: main, App, providers, router, стили
  pages/               # Страницы (композиция виджетов и фич)
    login/
    dashboard/
    ...
  widgets/            # Составные блоки UI (layout, таблицы, карточки)
    layout/
  features/           # Действия пользователя (auth, создание продукта, ответ на отзыв)
    auth/
  entities/           # Бизнес-сущности (user, product, feedback, product-return)
    user/
  shared/             # Переиспользуемый код
    api/              # HTTP-клиент, токены, типы ответов
    config/           # env
    lib/              # formatDate, getApiMessage и т.д.
    ui/               # Переэкспорт Ant Design
```

Правило импортов: слой может импортировать только из нижележащих слоёв (например, `features` → `entities`, `shared`). Публичный API слайса — через `index.ts`.

## Задачи

См. [tasks.md](./tasks.md) и [requirements.md](./requirements.md).
