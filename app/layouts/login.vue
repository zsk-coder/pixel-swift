<template>
  <div class="flex min-h-screen flex-col bg-white text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-white">
    <LoginHeader />

    <main
      class="flex flex-1 items-start justify-center px-4 pb-10 pt-28 sm:px-6 sm:pb-14 sm:pt-32 lg:px-8 lg:pt-44"
    >
      <slot />
    </main>
  </div>
</template>
