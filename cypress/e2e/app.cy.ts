// https://on.cypress.io/api

describe('App Test', () => {
  it('visits the app root url', () => {
    cy.visit("/");
    cy.get("h1").should("be.visible");
  })
})
