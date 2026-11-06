import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { quotaForms } from "../scenes/usage";
import { Panel } from "../components/layout";
import { QuotaSection } from "../components/quota-bar";
export default () => [
  <Frame {...frame("quota", "credits-and-exhaustion")}>
    <Panel>
      <QuotaSection windows={quotaForms.slice(2)} credits />
    </Panel>
  </Frame>,
];
