let selectedPapers = new Set();
let currentFilter = 'all';
let currentTopic = '01_Epoxy增韧';
let currentColor = '#c0392b';

function loadState() {
  try {
    const saved = localStorage.getItem('literature_weekly_selected_v2');
    if (saved) {
      selectedPapers = new Set(JSON.parse(saved));
      selectedPapers.forEach(id => {
        const cb = document.getElementById('cb-' + id);
        if (cb) cb.checked = true;
        const card = document.getElementById(id);
        if (card) card.classList.add('selected');
      });
      updateCount();
    }
  } catch(e) { console.log('loadState error', e); }
}

function saveState() {
  localStorage.setItem('literature_weekly_selected_v2', JSON.stringify([...selectedPapers]));
}

function toggleSelect(paperId) {
  const card = document.getElementById(paperId);
  const cb = document.getElementById('cb-' + paperId);
  if (cb.checked) {
    selectedPapers.add(paperId);
    card.classList.add('selected');
  } else {
    selectedPapers.delete(paperId);
    card.classList.remove('selected');
  }
  updateCount();
  saveState();
  applyFilter();
}

function updateCount() {
  document.getElementById('selected-count').textContent = selectedPapers.size;
  document.getElementById('selected-total').textContent = selectedPapers.size;
}

function switchTopic(topic, tabEl, color) {
  currentTopic = topic;
  currentColor = color;
  document.querySelectorAll('.topic-tab').forEach(t => {
    t.classList.remove('active');
    t.style.background = 'white';
    t.style.color = t.style.borderColor;
  });
  tabEl.classList.add('active');
  tabEl.style.background = color;
  tabEl.style.color = 'white';
  document.querySelectorAll('.topic-content').forEach(c => c.classList.remove('active'));
  document.getElementById('topic-' + topic).classList.add('active');
  applyFilter();
}

function setFilter(filter, btnEl) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const cards = document.querySelectorAll('#topic-' + currentTopic + ' .paper-card');
  cards.forEach(card => {
    const id = card.id;
    const isSelected = selectedPapers.has(id);
    let show = true;
    if (currentFilter === 'selected' && !isSelected) show = false;
    if (currentFilter === 'unselected' && isSelected) show = false;
    if (show) card.classList.remove('hidden');
    else card.classList.add('hidden');
  });
}

function searchPapers(keyword) {
  if (!keyword) {
    applyFilter();
    return;
  }
  const cards = document.querySelectorAll('#topic-' + currentTopic + ' .paper-card');
  const lower = keyword.toLowerCase();
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    if (text.includes(lower)) card.classList.remove('hidden');
    else card.classList.add('hidden');
  });
}

function clearAll() {
  if (!confirm('确定要清空所有标记吗？')) return;
  selectedPapers.clear();
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('.paper-card').forEach(c => c.classList.remove('selected'));
  updateCount();
  saveState();
  applyFilter();
}

function exportSelected() {
  if (selectedPapers.size === 0) {
    alert('请先标记感兴趣的文献！');
    return;
  }
  let text = '# 待下载文献DOI列表\n';
  text += '# 生成时间: ' + new Date().toLocaleString() + '\n\n';
  selectedPapers.forEach(id => {
    const card = document.getElementById(id);
    if (card) {
      const doiTag = card.querySelector('.meta-tag.doi a');
      const doi = doiTag ? doiTag.getAttribute('href').replace('https://doi.org/', '') : 'N/A';
      text += doi + '\n';
    }
  });
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'selected_dois_' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
}

function saveAndDownload() {
  if (selectedPapers.size === 0) {
    alert('请先标记感兴趣的文献！');
    return;
  }
  const selectedData = [];
  selectedPapers.forEach(id => {
    const card = document.getElementById(id);
    if (card) {
      const title = card.querySelector('.paper-title').textContent;
      const authors = card.querySelector('.paper-authors').textContent.replace('👤 ', '');
      const tags = card.querySelectorAll('.meta-tag');
      const journal = tags[0] ? tags[0].textContent : '';
      const date = tags[1] ? tags[1].textContent : '';
      const doiTag = card.querySelector('.meta-tag.doi a');
      const doi = doiTag ? doiTag.getAttribute('href').replace('https://doi.org/', '') : '';
      selectedData.push({
        id: id,
        topic: id.split('_')[0] + '_' + id.split('_')[1],
        title: title,
        authors: authors,
        journal: journal,
        date: date,
        doi: doi,
        selected_at: new Date().toISOString()
      });
    }
  });
  const jsonStr = JSON.stringify({
    doi_list: selectedData.map(d => d.doi).filter(d => d),
    metadata: Object.fromEntries(selectedData.map(d => [d.doi || d.id, d])),
    last_downloaded: null,
    report_date: '2026-06-07',
    total_selected: selectedData.length
  }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'selected_dois.json';
  a.click();
  alert('已保存 ' + selectedPapers.size + ' 篇文献到 selected_dois.json\n\n请每月运行一次下载脚本进行归档。');
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  loadState();
  const firstTab = document.querySelector('.topic-tab.active');
  if (firstTab) {
    firstTab.style.background = firstTab.style.borderColor;
    firstTab.style.color = 'white';
  }
  applyFilter();
});
