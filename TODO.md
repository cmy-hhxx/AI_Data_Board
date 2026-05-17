# 需求方面
1. 现在有两个导航栏，感觉不是一个很好的设计，请重新和我讨论，并设计一个更好的形态出来
2. 文档页面其实应该独立于项目， 比如我有新人入职培训文档，那么这个文档可能不属于当前任何任务，现在的设计逻辑有问题， 重新和我讨论，并重做
3. 

# UI方面
1. 

# bugs
1. 修复这个首页进入时， 前端F12控制台的报错：
```
react-dom_client.js?v=602469f3:2156 In HTML, <button> cannot be a descendant of <button>.
This will cause a hydration error.

  <App>
    <BoardProvider>
      <AppContent>
        <div className="min-h-screen">
          <Sidebar>
            <div>
            <div className="fixed top-...">
              <nav>
              <nav className="flex items...">
>               <button
>                 onClick={function onClick}
>                 className="group/item relative flex items-center gap-2 h-7 px-3 rounded-full text-xs font-medium whi..."
>               >
                  <span>
>                 <button
>                   onClick={function onClick}
>                   className="p-0.5 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-a..."
>                 >
                ...
          ...
validateDOMNesting	@	react-dom_client.js?v=602469f3:2156
```

2. 修复任务看板修改任务详情触发的bug, 不能正常完成修改：
```
Uncaught (in promise) Error: API error: 400
    at request (api.ts:14:22)
    at async handleTaskUpdate (BoardView.tsx:88:21)
```