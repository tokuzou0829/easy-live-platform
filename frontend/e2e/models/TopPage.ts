import { Base } from "./Base";

export class TopPage extends Base {
  async goTo() {
    await this.init();

    return await this.page.goto("/");
  }
}