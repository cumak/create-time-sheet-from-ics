<script setup lang="ts">
import { ref, watch } from 'vue';
import { useHead } from '@unhead/vue'

useHead({
  title: "Create Time sheet from .ics",
})

const isLoading = ref(false);
const selectText = ref("Googleカレンダーからエクスポートした.icsファイルを選択");
const content = ref("");
const result = ref("");
const table = ref("");
const columnsList = ref([
  { name: "日付", key: "date", show: true },
  { name: "タスク名", key: "summary", show: true },
  { name: "開始日時", key: "datetimeStart", show: true },
  { name: "終了日時", key: "datetimeEnd", show: true },
  { name: "所要時間", key: "duration", show: true },
  { name: "メモ", key: "memo", show: true },
]);

const handleSubmit = async (e:Event) => {
  isLoading.value = true;
  const target = e.target as HTMLInputElement;
  if(!target.files || !target.files?.length) {
    alert("ファイルが選択されていません");
    isLoading.value = false;
    return;
  }
  const files = Array.from(target.files);
  refClear();
  try {
    for (const [i, file] of files.entries()) {
      const fileContent = await readFileAsText(file as File);
      content.value += fileContent;
      result.value += processICS(fileContent,i);
      selectText.value = selectText.value ? `${selectText.value}<br>${file.name}` : file.name;
    }
    table.value = convertTableHtml(result.value);
  } catch (error) {
    console.error("Failed to read file:", error);
  } finally {
    isLoading.value = false;
  }
}

function refClear() {
  content.value = "";
  result.value = "";
  table.value = "";
  selectText.value = "";
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
function processICS(fileContent:string, i?:number) {
  const lines = parseIcsLines(fileContent);
  type ColItem = {
    startDate: Date | null;
    datetimeStart: Date | null;
    datetimeEnd: Date | null;
    summary: string | null;
    description: string | null;
  };
  const colItem:ColItem = {
    startDate: null,
    datetimeStart: null,
    datetimeEnd: null,
    summary: null,
    description: null,
  }
  let resultString = "";
  if(!i) {
    columnsList.value.forEach(column => {
      if (column.show) {
        resultString += column.name + "\t";
      }
    });
    resultString = resultString.trim() + "\n";
  }

  let currentOffset = 0;

  lines.forEach((line,i) => {
    line = line.trim();

    if (line.startsWith("BEGIN:VEVENT")) {
      colItem.startDate = null;
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
      const matchTime = line.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      const matchDate = line.match(/(\d{4})(\d{2})(\d{2})/);
      if (matchTime) {
        const [_, year, month, day, hour, minute] = matchTime.map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        colItem.datetimeStart = new Date(utcDate.getTime() + currentOffset * 60 * 1000);
      }
      if (matchDate) {
        const [_, year, month, day] = matchDate.map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        colItem.startDate = new Date(utcDate.getTime() + currentOffset * 60 * 1000);
      }
    } else if (line.startsWith("DTEND")) {
      const matchTime = line.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if (matchTime) {
        const [_, year, month, day, hour, minute] = matchTime.map(Number);
        const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
        colItem.datetimeEnd = new Date(utcDate.getTime() + currentOffset * 60 * 1000);
      }
    } else if (line.startsWith("SUMMARY:")) {
      colItem.summary = line.replace("SUMMARY:", "").trim().replace(/\\,/g, ",");
    } else if (line.startsWith("DESCRIPTION:")) {
      let rawDescription = line
      rawDescription = rawDescription.replace("DESCRIPTION:", "")
      let thisIndex = i;
      while(lines[thisIndex + 1]?.startsWith(" ")) {
        rawDescription += lines[thisIndex + 1].trim();
        thisIndex++;
      }
      rawDescription = rawDescription.replace(/\\n/g, "\n")
      rawDescription = rawDescription.replace(/\n$/, "");
      if (rawDescription.includes("\n")) {
        rawDescription = `"${rawDescription}"`;
      }
      rawDescription = rawDescription
        .replace(/\\,/g, ",");
        
      colItem.description = rawDescription;
    } else if (line.startsWith("END:VEVENT")) {
      let durationHours = ""
      if(colItem.datetimeStart && colItem.datetimeEnd) {
        durationHours = ((Number(colItem.datetimeEnd) - Number(colItem.datetimeStart)) / (1000 * 60 * 60)).toFixed(2);
      }
      const startStr = colItem.datetimeStart?.toISOString().replace("T", " ").slice(0, 16) || "";
      const endStr = colItem.datetimeEnd?.toISOString().replace("T", " ").slice(0, 16) || "";
      const memo = colItem.description || "";

      const row: string[] = [];
      columnsList.value.forEach(needColumn => {
        if (needColumn.show) {
          let val = "";
          if (needColumn.key === "date") {
            val = colItem.startDate ? colItem.startDate.toISOString().slice(0, 10) : "";
          }
          if (needColumn.key === "summary") val = colItem.summary || "";
          if (needColumn.key === "datetimeStart") val = startStr;
          if (needColumn.key === "datetimeEnd") val = endStr;
          if (needColumn.key === "duration") val = durationHours;
          if (needColumn.key === "memo") val = memo;
          row.push(val);
        }
      });
      resultString += row.join("\t") + "\n";
    }
  });

  return resultString;
}

function parseIcsLines(fileContent: string): string[] {
  // CRLFやCRをLFに統一
  const normalized = fileContent.replace(/\r\n|\r/g, "\n");
  // 折り返し（folded line）を結合：次の行がスペース or タブで始まるものは前の行と結合
  const unfolded = normalized.replace(/\n[ \t]/g, "");
  // 最終的に論理的な行ごとに分割
  return unfolded.split("\n");
}

const convertTableHtml = (tableString:string) => {
  const rows = tableString.split("\n");
  const theadRows: string[] = [];
  const tbodyRows: string[] = [];

  rows.forEach((row, rowIndex) => {
    if (row === "") return;
    const columns = row.split("\t");
    const tds = columns.map((column, i) => {
      // 最初が " の場合、次の行まで結合
      if (column.startsWith('"')) {
        let nextRow = rows[rowIndex + 1];
        while (!nextRow.endsWith('"')) {
          column += '<br>' + nextRow;
          rows.splice(rowIndex + 1, 1);
          nextRow = rows[rowIndex + 1];
        }
        column += '<br>' + nextRow;
        rows.splice(rowIndex + 1, 1);
        column = column.slice(1, -1); // 両端の " を削除
      }

      if (rowIndex === 0) {
        return `<th>${column}</th>`;
      }

      return `<td class="col-${getIndexFromIndex(i)}">${column}</td>`;
    });

    const tr = `<tr>${tds.join("")}</tr>`;
    if (rowIndex === 0) {
      theadRows.push(tr);
    } else {
      tbodyRows.push(tr);
    }
  });

  const tableHTML = `
  <table class="resultTable">
    <thead>
      ${theadRows.join("\n")}
    </thead>
    <tbody>
      ${tbodyRows.join("\n")}
    </tbody>
  </table>
  `;
  return tableHTML;
}

function getIndexFromIndex(i:number) {
  let key = "";
  const showedColumns = columnsList.value.filter(col => col.show);
  showedColumns.forEach((column, index) => {
    if (index === i) {
      key = column.key;
    }
  });
  return key || "";
}

watch(columnsList, () => {
  if (result.value) {
    // needColumnが変更された場合、再度変換を行う
    result.value = processICS(content.value);
    table.value = convertTableHtml(result.value); 
  }
}, { deep: true });

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
      <div class="summary">
        <div class="lead">
          タイムシート用に作った変換ツールです。Googleカレンダーをエクセルにしたい時にご利用ください。<br>※タイムゾーンがAsia/Tokyoの場合、時間は日本時間に変換します。<br>
          <p class="lead-note">エクセルの区切り文字はタブに対応しています。タブ以外の区切り位置になっている場合は正常に貼り付けできません。</p>
        </div>
        <div class="developHistory">
          <ul>
            <li class="is-new">複数ファイルの読み込みに対応しました。</li>
            <li class="is-new">時間の設定がないものも表示するようになりました。</li>
            <li class="is-new">列を選択できるようになりました。</li>
          </ul>
        </div>
      </div>
      <div class="needColumn">
        <label v-for="column in columnsList" :key="column.key" class="needColumn-item">
          <input type="checkbox" v-model="column.show" />
          {{ column.name }}
        </label>
      </div>
      <div class="formArea">
        <form class="form" method="POST" enctype="multipart/form-data">
          <label class="form-label">
            <input type="file" name="file" accept=".ics" multiple required @change="handleSubmit">
            <span class="form-text" v-html="selectText"></span>
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
      <div class="footer-note">
        <p>アップロードされたデータはサーバーに送信されず、すべての変換処理はブラウザ上で行われます。</p>
      </div>
      <div class="footer-author">
        <div class="footer-author-inner">
          created by
          <a href="https://cumak.net/" target="_blank"><span class="footer-author-cumak"><img src="/cumak-mark.svg" alt="cumak.net" width="20" height="25"></span></a>
          <a href="https://github.com/cumak/create-time-sheet-from-ics" target="_blank"><span class="footer-author-github"><img src="/icon-github-mark.svg" alt="github" width="32" height="32"></span></a>
        </div>
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

.summary{
  display: flex;
  gap: 50px;
  margin-top: 40px;
  @include sp{
    flex-direction: column;
    gap: 20px;
  }
}

.lead{
  font-weight: bold;
  color: #333;
  @include sp{
    @include section-center-sp;
  }
  &-note{
    @include font-rem(12);
    color: #7d7d7d;
    margin-top: 10px;
    line-height: 1.5;
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
    word-break: break-all;
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
  th{
    white-space: nowrap;
  }
  th, td{
    border: 1px solid #c6c6c6;
    padding: 4px 12px;
    @include font-rem(12);
    &.al-r{
      text-align: right;
    }
    &.col-duration{
      text-align: right;
    }
    &.col-date{
      white-space: nowrap;
    }
    &.col-startDate, &.col-endDate{
      white-space: nowrap;
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
  white-space: nowrap;
  @include sp{
    margin-left: 0;
  }
  &:disabled{
    background: #c6c6c6;
    cursor: not-allowed;
  }
}

.footer{
  background: #f2f2f2;
  border-top: 1px solid #ccc;
  &-note{
    padding: 10px 5% 5px;
    font-size: 12px;
  }
  &-author{
    display: flex;
    justify-content: flex-end;
    padding: 4px 10px;
    background: #9e9e9e;
    color: #fff;
    &-inner{
      display: flex;
      align-items: center;
      gap: 6px;
      @include font-rem(13);
    }
    &-cumak{
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      border-radius: 50%;
      border: 1px solid #e4e4e4;
      height: 32px;
      background: #f2f2f2;
    }
    &-github{
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 1px solid #000;
    }
  }
}

.developHistory{
  @include pc-tab{
    padding-left: 20px;
    border-left: 1px solid #c6c6c6;
  }
  @include sp{
    margin-left: 0;
    @include section-center-sp;
  }
  ul{
    background: #faf9f1;
    padding: 10px;
    border-radius: 8px;
    
    li{
      display: flex;
      @include font-rem(12);
      & + li{
        margin-top: 10px;
      }
      &.is-new{
        &::before{
          content: "NEW";
          height: fit-content;
          color: #333;
          margin-right: 5px;
          border: 1px solid #ca0707;
          padding: 2px 4px;
          line-height: 1;
          color: #ca0707;
          @include font-rem(10);
        }
      }
    }
  }
}

.needColumn{
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 20px;
  @include sp{
    gap: 10px;
    @include section-center-sp;
  }
  &-item{
    display: flex;
    align-items: center;
    gap: 3px;
    @include font-rem(14);
    color: #333;
    input{
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
  }
}
</style>
