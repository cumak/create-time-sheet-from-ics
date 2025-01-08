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
    cy.get(".resultTable").should("contain.html", '<td class="al-r">1.00</td>');
  });
});
