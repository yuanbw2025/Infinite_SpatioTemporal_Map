<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const categories = [
  {
    name: '经',
    books: []
  },
  {
    name: '史',
    books: [
      { id: 'ershisishe', title: '二十四史 (文白对照)', author: '二十四史编委会', type: '正史' },
      { id: 'wangyangming', title: '王阳明传', author: '明史', type: '传记' },
      { id: 'zhangjuzheng', title: '张居正传', author: '明史', type: '传记' }
    ]
  },
  {
    name: '子',
    books: [
      { id: 'chuanxilu', title: '传习录', author: '王守仁', type: '哲学' }
    ]
  },
  {
    name: '集',
    books: []
  },
  {
    name: '方志',
    books: [
      { id: 'quanzhou', title: '乾隆泉州府志', author: '怀荫布等', type: '府志' },
      { id: 'nanning', title: '嘉靖南宁府志', author: '郭楠等', type: '府志' }
    ]
  }
]

function openBook(bookId) {
  router.push({ path: '/reader', query: { book: bookId } })
}
</script>

<template>
  <div class="library-container">
    <div class="library-header">
      <h1>📚 典籍书库</h1>
      <p>四部综合典藏与方志特藏</p>
    </div>
    
    <div class="library-content">
      <div v-for="category in categories" :key="category.name" class="category-section">
        <div class="category-title">
          <h2>{{ category.name }}</h2>
          <div class="category-line"></div>
        </div>
        
        <div class="books-grid">
          <div 
            v-for="book in category.books" 
            :key="book.id" 
            class="book-card"
            @click="openBook(book.id)"
          >
            <div class="book-cover">
              <span class="book-type">{{ book.type }}</span>
            </div>
            <div class="book-info">
              <h3>{{ book.title }}</h3>
              <p>{{ book.author }}</p>
            </div>
          </div>
          
          <div v-if="category.books.length === 0" class="empty-state">
            暂无典籍
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-container {
  width: 100%;
  height: 100%;
  background: #f5f0d6;
  color: #2c2825;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-header {
  padding: 30px 40px;
  background: #e8e0c0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.library-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
  color: #8b0000;
  font-weight: bold;
}

.library-header p {
  color: #5c5346;
  font-size: 14px;
}

.library-content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.category-title h2 {
  font-size: 24px;
  color: #2c2825;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
}

.category-line {
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.1);
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 24px;
}

.book-card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.book-card:hover {
  transform: translateY(-4px);
}

.book-card:hover .book-cover {
  box-shadow: 4px 8px 16px rgba(0, 0, 0, 0.15);
  border-color: #8b0000;
}

.book-cover {
  height: 220px;
  background: #e3d9b1;
  border: 1px solid #c0b386;
  border-radius: 4px 8px 8px 4px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 12px;
  position: relative;
  box-shadow: 2px 4px 8px rgba(0, 0, 0, 0.05);
}

/* 模拟线装书的侧边线 */
.book-cover::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 2px;
  border-left: 2px dashed rgba(0, 0, 0, 0.2);
}

.book-type {
  font-size: 12px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.5);
  color: #8b0000;
  border-radius: 2px;
  font-weight: bold;
}

.book-info {
  margin-top: 12px;
}

.book-info h3 {
  font-size: 16px;
  color: #2c2825;
  margin-bottom: 4px;
  font-weight: bold;
}

.book-info p {
  font-size: 13px;
  color: #5c5346;
}

.empty-state {
  color: #a09786;
  font-size: 14px;
  font-style: italic;
  padding: 20px 0;
}
</style>
