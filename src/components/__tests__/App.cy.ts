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
    cy.get(".col-summary").should("not.exist");
    // needColumn-itemのチェックボックスをオンにすると、「タスク名」の列が表示されることを確認
    cy.get(".needColumn-item input[type='checkbox']").eq(1).check();
    cy.get(".resultTable thead th").should("contain.text", "タスク名");
    cy.get(".col-summary").should("exist");

    // この状態でsample2.icsをアップロードすると、クリアされてからアップロードされることを確認
    const fileName2 = "./sample2.ics";
    cy.get('input[type="file"]').attachFile(fileName2);
    // 行の数が12であることを確認
    cy.get(".resultTable tbody tr").should("have.length", 5);
    // selectTextに両方のファイル名が表示されていることを確認
    cy.get(".form-text").should("contain.html", "sample2.ics");
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

  it("サンプル1とサンプル2の同時アップロード", () => {
    // テスト用の `sample1.ics` と `sample2.ics` を同時にアップロード
    const files = ["./sample.ics", "./sample2.ics"];
    cy.get('input[type="file"]').attachFile(files);

    // コピーボタンがdisabledでないことを確認
    cy.get(".copyBtn").should("not.be.disabled");

    // テーブルが正しく表示されることを確認
    cy.get(".resultTable").should("exist");
    // テーブルに特定の文字列が含まれていることを確認
    cy.get(".resultTable").should("contain.html", ":~:~::-<br>Join");
    cy.get(".resultTable").should("contain.text", "Team Meeting");
    // 行の数が12であることを確認
    cy.get(".resultTable tbody tr").should("have.length", 12);
    // selectTextに両方のファイル名が表示されていることを確認
    cy.get(".form-text").should("contain.html", "sample.ics<br>sample2.ics");
  });
});
