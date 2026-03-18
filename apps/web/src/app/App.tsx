const upcomingRangeLabel = '可配置范围';

const smartViews = ['收件箱', '今天', '近期', '逾期'];
const sampleDirectories = [
  { name: '工作', children: ['A 项目', 'B 项目'] },
  { name: '生活', children: ['家庭', '采购'] },
];

const sampleItems = [
  { title: '和同事确认接口字段', progress: '进行中', expectedAt: '今天 18:00' },
  { title: '整理工作台上的临时想法', progress: '未开始', expectedAt: '明天' },
  { title: '更新部署笔记', progress: '已完成', expectedAt: '昨天', completed: true },
];

export function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__eyebrow">Personal Item Manager</span>
          <h1>My Pag</h1>
        </div>

        <section className="panel">
          <div className="panel__title">智能视图</div>
          <ul className="nav-list">
            {smartViews.map((view) => (
              <li key={view} className={`nav-list__item${view === '收件箱' ? ' is-active' : ''}`}>
                <span>{view}</span>
                {view === '近期' ? <small>{upcomingRangeLabel}</small> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel__title">目录</div>
          <div className="tree">
            {sampleDirectories.map((directory) => (
              <div key={directory.name} className="tree__group">
                <div className="tree__node">{directory.name}</div>
                <div className="tree__children">
                  {directory.children.map((child) => (
                    <div key={child} className="tree__node tree__node--child">
                      {child}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="content">
        <header className="content__header">
          <div>
            <span className="section-tag">当前视图</span>
            <h2>收件箱</h2>
          </div>
          <div className="toolbar">
            <button type="button">全部</button>
            <button type="button">未完成</button>
            <button type="button">显示已完成</button>
          </div>
        </header>

        <section className="list">
          {sampleItems.map((item) => (
            <article key={item.title} className={`card${item.completed ? ' card--done' : ''}`}>
              <div className="card__meta">
                <span>{item.progress}</span>
                <span>{item.expectedAt}</span>
              </div>
              <h3>{item.title}</h3>
            </article>
          ))}
        </section>

        <footer className="quick-create">
          <input
            aria-label="快速创建事项"
            placeholder="输入标题，回车后进入详情补充字段"
            type="text"
          />
        </footer>
      </main>

      <aside className="detail">
        <div className="detail__header">
          <span className="section-tag">详情区</span>
          <button type="button">保存</button>
        </div>
        <div className="detail__body">
          <label>
            标题
            <input defaultValue="和同事确认接口字段" type="text" />
          </label>
          <label>
            备注
            <textarea defaultValue="先确认字段命名，再开始联调。" rows={6} />
          </label>
          <label>
            进度
            <select defaultValue="进行中">
              <option>未开始</option>
              <option>进行中</option>
              <option>已完成</option>
              <option>搁置</option>
            </select>
          </label>
        </div>
      </aside>
    </div>
  );
}
