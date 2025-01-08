<script setup lang="ts">
import { ref } from 'vue';
import { useHead } from '@unhead/vue'

useHead({
  title: "Create Time sheet from .ics",
})

const isLoading = ref(false);
const selectText = ref("Googleカレンダーからエクスポートした.icsファイルを選択");
const result = ref("");
const table = ref("");

const handleSubmit = async (e:Event) => {
  isLoading.value = true;
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if(!file) {
    alert("ファイルが選択されていません");
    isLoading.value = false;
    return;
  }
  try {
    const fileContent = await readFileAsText(file);
    result.value = processICS(fileContent);
    selectText.value = file.name;
    table.value = convertTableHtml(result.value);
  } catch (error) {
    console.error("Failed to read file:", error);
  } finally {
    isLoading.value = false;
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
  });
}

// ICSファイル処理
function processICS(content:string) {
  const lines = content.split("\n");
  type ColItem = {
    datetimeStart: Date | null;
    datetimeEnd: Date | null;
    summary: string | null;
    description: string | null;
  };
  const colItem:ColItem = {
    datetimeStart: null,
    datetimeEnd: null,
    summary: null,
    description: null,
  }
  let resultString = "タスク名\t開始日時\t終了日時\t所要時間\tメモ\n";
  let currentOffset = 0;

  lines.forEach((line,i) => {
    line = line.trim();

    if (line.startsWith("BEGIN:VEVENT")) {
      colItem.datetimeStart = null;
      colItem.datetimeEnd = null;
      colItem.summary = null;
      colItem.description = null;
    } else if (line.startsWith("TZOFFSETFROM:")) {
      const match = line.match(/TZOFFSETFROM:([+-]\d{2})(\d{2})/);
      if (match) {
        const [_, hours, minutes] = match.map(Number);
        currentOffset = hours * 60 + Math.sign(hours) * minutes;
      }
    } else if (line.startsWith("DTSTART")) {
      const match = line.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (match) {
        const [_, year, month, day, hour, minute] = match.map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        colItem.datetimeStart = new Date(utcDate.getTime() + currentOffset * 60 * 1000);
      }
    } else if (line.startsWith("DTEND")) {
      const match = line.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (match) {
        const [_, year, month, day, hour, minute] = match.map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        colItem.datetimeEnd = new Date(utcDate.getTime() + currentOffset * 60 * 1000);
      }
    } else if (line.startsWith("SUMMARY:")) {
      colItem.summary = line.replace("SUMMARY:", "").trim().replace(/\\,/g, ",");
    } else if (line.startsWith("DESCRIPTION:")) {
      let rawDescription = line
      rawDescription = rawDescription.replace("DESCRIPTION:", "")
      const thisIndex = i;
      while(lines[thisIndex + 1]?.startsWith(" ")) {
        rawDescription = nextLinePush(lines, i, rawDescription);
      }
      rawDescription = rawDescription.replace(/\\n/g, "\n")
      if (rawDescription.includes("\n")) {
        rawDescription = `"${rawDescription}"`;
      }
      rawDescription = rawDescription
        .replace(/\\,/g, ",");
        
      colItem.description = rawDescription;
    } else if (line.startsWith("END:VEVENT")) {
      if (colItem.datetimeStart && colItem.datetimeEnd) {
        const durationHours = ((Number(colItem.datetimeEnd) - Number(colItem.datetimeStart)) / (1000 * 60 * 60)).toFixed(2);
        const startStr = colItem.datetimeStart.toISOString().replace("T", " ").slice(0, 16);
        const endStr = colItem.datetimeEnd.toISOString().replace("T", " ").slice(0, 16);

        const memo = colItem.description || "";

        resultString += `${colItem.summary}\t${startStr}\t${endStr}\t${durationHours}\t${memo}\n`;
      }
    }
  });

  return resultString;
}

function nextLinePush(lines:string[], index:number, rawDescription:string) {
  rawDescription += lines[index + 1].trim();
  lines.splice(index + 1, 1);
  return rawDescription;
}

const convertTableHtml = (tableString:string) => {
  const rows = tableString.split("\n");
  const table = rows.map((row) => {
    if(row === "") return "";
    const columns = row.split("\t");
    const tds = columns.map((column,i) => {
      if (row === rows[0]) {
        return `<th>${column}</th>`;
      }
      //最初が"の場合、次の行まで結合する
      if (column.startsWith('"')) {
        let nextRow = rows[rows.indexOf(row) + 1];
        while (!nextRow.endsWith('"')) {
          column += '<br>' + nextRow;
          rows.splice(rows.indexOf(nextRow), 1);
          nextRow = rows[rows.indexOf(row) + 1];
        }
        column += '<br>' + nextRow;
        rows.splice(rows.indexOf(nextRow), 1);
        // "を削除
        column = column.slice(1, -1);
      }
      if (i === 3) {
        return `<td class="al-r">${column}</td>`;
      }
      return `<td>${column}</td>`;
    });
    return `<tr>${tds.join("")}</tr>`;
  });
  return `<table class="resultTable">${table.join("")}</table>`;
}

const copy = () => {
  if(!result.value) {
    alert("変換されたデータがありません");
    return;
  }
  navigator.clipboard.writeText(result.value)
    .then(() => alert('クリップボードにコピーされました。\nExcelに貼り付けてください。'))
    .catch(err => alert('コピーに失敗しました: ' + err));
}
</script>

<template>
  <div class="container">
    <header class="header">
      <h1 class="header-logo">
        <img src="/logo.svg" alt="Create Time sheet from .ics" width="380" height="28">
      </h1>
    </header>
  
    <main class="main">
      <div class="lead">タイムシート用に作った変換ツールです。Googleカレンダーをエクセルにしたい時にご利用ください。<br>※タイムゾーンがAsia/Tokyoの場合、時間は日本時間に変換します。</div>
      <div class="formArea">
        <form class="form" method="POST" enctype="multipart/form-data">
          <label class="form-label">
            <input type="file" name="file" accept=".ics" required @change="handleSubmit">
            <span class="form-text">{{selectText}}</span>
          </label>
        </form>
        <div class="loading" v-if="isLoading"></div>
        <button class="copyBtn" @click="copy" type="button" :disabled="!result">クリップボードにコピー</button>
      </div>
      <div class="tableWrap">
        <div v-html="table"></div>
      </div>
    </main>
    <footer class="footer">
      <div class="footer-author">
        created by <a href="https://cumak.net/" target="_blank"><span class="footer-author-icon"><img src="/cumak-mark.svg" alt="cumak.net" width="20" height="25"></span></a>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
@use "@/assets/styles/foundation/variable" as *;

.container{
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  background-color: #333;
  padding: 10px 30px;
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  @include sp{
    height: 40px;
    padding: 5px 12px;
  }
  &-logo{
    display: flex;
    align-items: center;
    img{
      @include sp{
        height: 16px;
        width: auto;
      }
    }
  }
}
.main{
  flex:1;
  @include section-center;
  padding-bottom: 40px;
  @include sp{
    padding-inline: 0;
  }
}
.lead{
  margin-top: 40px;
  font-weight: bold;
  color: #333;
  @include sp{
    @include section-center-sp;
  }
}

.formArea{
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 50px;
  @include sp{
    @include section-center-sp;
    flex-direction: column;
    gap: 20px;
  }
}

.form{
  flex:1;
  @include sp{
    width: 100%;
  }
  &-label{
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100px;
    padding: 10px;
    background: #f2f2f2;
    cursor: pointer;
    border: 1px solid #c6c6c6;
    @include sp{
      width: 100%;
    }
  }
  input{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  &-text{
    display: block;
    @include font-rem(14);
    color: #7d7d7d;
    font-weight: bold;
  }
}

.loading{
  position: absolute;
  top: 25px;
  left: calc(50% - 25px);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border-top: 2px solid #404040;
  border-right: 2px solid #404040;
  animation: loading 1s linear infinite;
  pointer-events: none;
}

@keyframes loading {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.tableWrap{
  @include sp{
    overflow-x: scroll;
  }
}

::v-deep(.resultTable) {
  margin-top: 50px;
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #c6c6c6;
  @include sp{
    min-width: 120%;
    margin-left: 5%;
  }
  th, td{
    border: 1px solid #c6c6c6;
    padding: 4px 12px;
    @include font-rem(12);
    &.al-r{
      text-align: right;
    }
  }
  th{
    background: #f2f2f2;
    font-weight: bold;
  }
}

.copyBtn{
  appearance: none;
  border: none;
  background: #03abda;
  color: #fff;
  padding: 10px 20px;
  margin-left: 60px;
  cursor: pointer;
  font-weight: bold;
  @include sp{
    margin-left: 0;
  }
  &:disabled{
    background: #c6c6c6;
    cursor: not-allowed;
  }
}

.footer{
  display: flex;
  justify-content: flex-end;
  background: #9e9e9e;
  padding: 4px 10px;
  color: #fff;
  &-author{
    display: flex;
    align-items: center;
    gap: 6px;
    @include font-rem(13);
    &-icon{
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      border-radius: 50%;
      border: 1px solid #e4e4e4;
      height: 32px;
      background: #f2f2f2;
    }
  }
}

</style>
