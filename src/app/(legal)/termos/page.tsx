import Link from "next/link";
import { LEGAL_PATHS, MIN_AGE, RESPONSIBLE, SERVICE_NAME } from "@/lib/legal";
import { ContactLink, LegalDoc, P, Section, Ul } from "../legal-doc";

export const metadata = { title: "Termos de Uso" };

export default function TermosPage() {
  return (
    <LegalDoc
      title="Termos de Uso"
      summary={
        <p>
          Em poucas palavras: o {SERVICE_NAME} é um beta gratuito, feito por um grupo de pesquisa, para pessoas convidadas. Use com boa-fé, mantenha a conta só sua e confira os números antes de usá-los em uma cobrança. O serviço pode mudar ou
          parar, então baixe cópias dos seus dados de vez em quando. Você pode excluir a conta a qualquer momento.
        </p>
      }
    >
      <Section title="1. Quem oferece o serviço e quem pode usá-lo">
        <P>
          O {SERVICE_NAME} é oferecido pelo {RESPONSIBLE}, sem fins lucrativos. O grupo é um grupo de pesquisa e não tem pessoa jurídica própria. Neste momento o serviço está em <strong>beta fechado</strong>: só entram pessoas liberadas pelo grupo ou
          convidadas para um workspace. Para usar, você precisa ter {MIN_AGE} anos ou mais e aceitar estes termos e a{" "}
          <Link href={LEGAL_PATHS.privacy} className="underline underline-offset-4">
            Política de Privacidade
          </Link>
          . Ao entrar, você declara que leu e concorda.
        </P>
      </Section>

      <Section title="2. O que o serviço faz, e o que não promete">
        <P>O {SERVICE_NAME} registra tempo de trabalho por cliente, projeto e tarefa e gera relatórios que podem ser baixados em XLSX, CSV e PDF. É um beta: oferecido no estado em que está, enquanto durar.</P>
        <Ul>
          <li>Não há garantia de disponibilidade, de ausência de erros nem de que o serviço continue existindo. Funções podem mudar, ser limitadas ou ser retiradas, e o serviço pode ser encerrado.</li>
          <li>
            <strong>Relatórios e valores de faturamento devem ser conferidos por você</strong> antes de serem usados para cobrar alguém, prestar contas ou tomar qualquer decisão. O serviço é uma ferramenta de apoio e não substitui a sua conferência.
          </li>
          <li>Faça cópias: use <strong>Minha conta &gt; Baixar meus dados</strong> e os relatórios exportados para guardar o que importa para você.</li>
        </Ul>
      </Section>

      <Section title="3. Sua conta">
        <Ul>
          <li>Entre com um e-mail seu e mantenha o acesso só seu. Você responde pelo que for feito na sua conta.</li>
          <li>Informe dados verdadeiros e avise o contato se suspeitar de acesso indevido.</li>
          <li>Você pode excluir a conta quando quiser, em <strong>Minha conta</strong>. A exclusão é imediata e não tem volta. A Política de Privacidade explica o que acontece com os seus dados.</li>
        </Ul>
      </Section>

      <Section title="4. Seu conteúdo e os workspaces">
        <Ul>
          <li>Os dados que você registra continuam sendo seus (ou de quem você representa). Você autoriza o serviço a guardá-los e processá-los apenas para operar o {SERVICE_NAME}.</li>
          <li>
            Num workspace, quem tem a função de administrador pode ver, corrigir e exportar os registros de horas dos membros, conforme as permissões do workspace. Antes de participar do workspace de outra pessoa, saiba que ela terá acesso ao que você
            lançar ali.
          </li>
          <li>Quem convida alguém responde por esse convite: convites contam como acesso ao beta. Convide só quem tem a ver com o trabalho do workspace.</li>
          <li>Não registre dados pessoais sensíveis nem dados de terceiros que você não deveria compartilhar, principalmente nos textos de descrição dos registros.</li>
        </Ul>
      </Section>

      <Section title="5. Uso aceitável">
        <P>Não é permitido:</P>
        <Ul>
          <li>usar o serviço para atividade ilegal ou para prejudicar outras pessoas;</li>
          <li>tentar burlar limites, verificações ou o controle de acesso, ou acessar dados de workspaces dos quais você não faz parte;</li>
          <li>sobrecarregar o serviço, automatizar pedidos em volume ou criar contas para contornar o beta fechado;</li>
          <li>revender o serviço ou apresentá-lo como se fosse de outra pessoa.</li>
        </Ul>
        <P>
          Se encontrar uma falha de segurança, avise em <ContactLink subject="Falha de segurança no Compasso" /> em vez de explorá-la.
        </P>
      </Section>

      <Section title="6. Suspensão e encerramento">
        <P>
          Podemos suspender ou encerrar o acesso de quem violar estes termos, de quem representar risco ao serviço ou a outras pessoas, e de todos, se o beta terminar. Sempre que possível avisaremos antes e daremos a chance de baixar os seus dados.
        </P>
      </Section>

      <Section title="7. Limitação de responsabilidade">
        <P>
          Na medida em que a lei permitir, o {RESPONSIBLE} não responde por perda de dados, lucros cessantes, prejuízos indiretos ou decorrentes de indisponibilidade ou de erro do serviço, nem por decisões tomadas com base nos relatórios. Nada nestes termos
          limita direitos que a lei não permite limitar.
        </P>
      </Section>

      <Section title="8. Código-fonte e marca">
        <P>
          O código do {SERVICE_NAME} pertence ao ASSERT Lab e não é licenciado a terceiros: todos os direitos reservados. Versões antigas, publicadas sob a licença MIT, continuam sob ela. A reserva de direitos vale para o código, não para os dados de ninguém. O nome e o logotipo do {SERVICE_NAME} e do ASSERT Lab pertencem ao grupo.
        </P>
      </Section>

      <Section title="9. Mudanças, lei aplicável e contato">
        <P>
          Podemos atualizar estes termos. A versão e a data ficam no topo desta página e na tela de entrada; mudanças importantes serão avisadas no aplicativo ou por e-mail. Continuar usando o serviço depois de uma mudança significa aceitá-la. Aplica-se a lei
          brasileira. Antes de qualquer medida, tente resolver conosco: <ContactLink />.
        </P>
      </Section>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Estes textos foram escritos em linguagem simples para o beta fechado e ainda não passaram por revisão jurídica. Serão revisados antes de qualquer abertura pública do serviço.
      </p>
    </LegalDoc>
  );
}
