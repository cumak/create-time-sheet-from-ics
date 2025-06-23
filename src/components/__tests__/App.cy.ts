import { mount } from "cypress/vue";
import App from "@/App.vue";
import "cypress-file-upload";

describe("サンプルファイルのアップロードの正常性と結果表示", () => {
  beforeEach(() => {
    mount(App);
  });

  it("サンプル1ファイルのアップロード", () => {
    // テスト用の `sample1.ics` をアップロード
    const fileName = "./sample.ics";
    cy.get('input[type="file"]').attachFile(fileName);

    // コピーボタンがdisabledでないことを確認
    cy.get(".copyBtn").should("not.be.disabled");

    // テーブルが正しく表示されることを確認
    cy.get(".resultTable").should("exist");
    // テーブルに特定の文字列が含まれていることを確認
    cy.get(".resultTable").should("contain.html", ":~:~::-<br>Join");
    // 行の数が7であることを確認
    cy.get(".resultTable tbody tr").should("have.length", 7);
    // needColumn-itemのチェックボックスをオフにすると、「タスク名」の列が非表示になることを確認
    cy.get(".needColumn-item input[type='checkbox']").eq(1).uncheck();
    cy.get(".resultTable thead th").should("not.contain.text", "タスク名");
    // needColumn-itemのチェックボックスをオンにすると、「タスク名」の列が表示されることを確認
    cy.get(".needColumn-item input[type='checkbox']").eq(1).check();
    cy.get(".resultTable thead th").should("contain.text", "タスク名");
  });

  it("サンプル2ファイルのアップロード", () => {
    // テスト用の `sample2.ics` をアップロード
    const fileName = "./sample2.ics";
    cy.get('input[type="file"]').attachFile(fileName);

    // コピーボタンがdisabledでないことを確認
    cy.get(".copyBtn").should("not.be.disabled");

    // テーブルが正しく表示されることを確認
    cy.get(".resultTable").should("exist");
    // テーブルに特定の文字列が含まれていることを確認
    cy.get(".resultTable").should("contain.text", "Team Meeting");
    // resultTableの行の5番目の５列目が"1.00"であることを確認
    cy.get(".resultTable tbody tr")
      .eq(4)
      .should("contain.html", '<td class="col-duration">7.00</td>');
  });
});
