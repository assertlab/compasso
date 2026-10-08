import { existsSync } from "node:fs";
import path from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { type ExportRow, formatDateBr, formatTimeSpan } from "@/lib/report-export";
import { GROUP_LABELS, type ReportSummary } from "@/lib/report";
import { formatHms, toDecimalHours } from "@/lib/time";

const FONT = "Plex";
const FALLBACK = "Helvetica";

/** IBM Plex Sans (ADR-010/014) from the installed @fontsource files; falls back to Helvetica if they are not on disk. */
let family = FALLBACK;
function registerFonts() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans/files");
  const regular = path.join(dir, "ibm-plex-sans-latin-400-normal.woff");
  const bold = path.join(dir, "ibm-plex-sans-latin-600-normal.woff");
  if (!existsSync(regular) || !existsSync(bold)) return;
  Font.register({ family: FONT, fonts: [{ src: regular, fontWeight: 400 }, { src: bold, fontWeight: 700 }] });
  family = FONT;
}
registerFonts();
// No automatic hyphenation: "Oracle" must not become "Ora-cle" in narrow columns.
Font.registerHyphenationCallback((word) => [word]);

/** App icon (compass on navy) used in the banner; skipped if the file is not on disk. */
const iconPath = path.join(process.cwd(), "public/icons/icon-192.png");
const icon = existsSync(iconPath) ? iconPath : null;

const NAVY = "#0e2e47";
const MUTED = "#5b6770";
const LINE = "#d5dbe0";
const GRID = "#b4bfc8";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 36, fontSize: 9, color: "#111", fontFamily: family },
  title: { fontSize: 16, fontWeight: 700, color: NAVY },
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: NAVY, marginHorizontal: -36, marginTop: -36, marginBottom: 16, paddingHorizontal: 36, paddingVertical: 14 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName: { fontSize: 15, fontWeight: 700, color: "#fff" },
  bannerTitle: { fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "right" },
  bannerSub: { fontSize: 8.5, color: "#a9c4d6", textAlign: "right", marginTop: 2 },
  muted: { color: MUTED },
  head: { marginBottom: 14, gap: 2 },
  stats: { flexDirection: "row", gap: 24, marginBottom: 14, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE },
  statLabel: { fontSize: 8, color: MUTED },
  statValue: { fontSize: 14, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderColor: LINE },
  th: { flexDirection: "row", paddingVertical: 3, backgroundColor: NAVY },
  thText: { color: "#fff", fontWeight: 700 },
  num: { textAlign: "right" },
  // Full grid for the entry table: outer edges on each row (rows can split across pages) and a rule between columns.
  gridEdge: { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: GRID },
  cell: { paddingHorizontal: 4, paddingVertical: 2.5, borderRightWidth: 0.5, borderColor: GRID },
  hcell: { paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: "#3d6079" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
});

const hours = (seconds: number) => toDecimalHours(seconds).toFixed(2).replace(".", ",");

function Banner({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={s.banner}>
      <View style={s.brand}>
        {/* react-pdf Image has no alt prop; the wordmark next to it carries the name. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {icon && <Image src={icon} style={{ width: 26, height: 26, borderRadius: 5 }} />}
        <Text style={s.brandName}>Compasso</Text>
      </View>
      <View>
        <Text style={s.bannerTitle}>{title}</Text>
        <Text style={s.bannerSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>Compasso · gerado em {generatedAt}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SummaryRow({ label, entries, seconds, indent, bold }: { label: string; entries: number; seconds: number; indent: number; bold?: boolean }) {
  const weight = bold ? 700 : 400;
  return (
    <View style={s.row} wrap={false}>
      <Text style={{ flex: 1, paddingLeft: indent * 12, fontWeight: weight }}>{label}</Text>
      <Text style={[s.num, { width: 50, fontWeight: weight }]}>{entries}</Text>
      <Text style={[s.num, { width: 64, fontWeight: weight }]}>{formatHms(seconds)}</Text>
      <Text style={[s.num, { width: 48, fontWeight: weight }]}>{hours(seconds)}</Text>
    </View>
  );
}

function SummaryHeader({ first }: { first: string }) {
  return (
    <View style={s.th}>
      <Text style={[s.thText, { flex: 1, paddingLeft: 4 }]}>{first}</Text>
      <Text style={[s.thText, s.num, { width: 50 }]}>Registros</Text>
      <Text style={[s.thText, s.num, { width: 64 }]}>Duração</Text>
      <Text style={[s.thText, s.num, { width: 48, paddingRight: 4 }]}>Horas</Text>
    </View>
  );
}

type Input = {
  period: string;
  filters: string[];
  generatedAt: Date;
  includePerson: boolean;
  summary: ReportSummary;
  rows: ExportRow[];
};

function ReportDocument({ period, filters, generatedAt, includePerson, summary, rows }: Input) {
  const stamp = formatDateBr(generatedAt.toISOString().slice(0, 10));
  return (
    <Document title={`Relatório de horas — ${period}`} author="Compasso" creator="Compasso">
      <Page size="A4" style={s.page}>
        <Banner title="Relatório de horas" subtitle={`Período: ${period}`} />
        <View style={s.head}>
          {filters.map((line) => (
            <Text key={line} style={s.muted}>
              {line}
            </Text>
          ))}
        </View>

        <View style={s.stats}>
          <View>
            <Text style={s.statLabel}>Total</Text>
            <Text style={s.statValue}>{formatHms(summary.totalSeconds)}</Text>
          </View>
          <View>
            <Text style={s.statLabel}>Horas</Text>
            <Text style={s.statValue}>{hours(summary.totalSeconds)}</Text>
          </View>
          <View>
            <Text style={s.statLabel}>Registros</Text>
            <Text style={s.statValue}>{summary.totalEntries}</Text>
          </View>
        </View>

        <SummaryHeader first={`Cliente / projeto / ${GROUP_LABELS[summary.groupBy].toLowerCase()}`} />
        {summary.clients.map((client) => (
          <View key={client.id ?? "none"}>
            <SummaryRow label={client.name} entries={client.entries} seconds={client.seconds} indent={0} bold />
            {client.id !== null &&
              client.projects.map((project) => (
                <View key={project.id ?? "none"}>
                  <SummaryRow label={project.name} entries={project.entries} seconds={project.seconds} indent={1} />
                  {project.items.map((task) => (
                    <SummaryRow key={task.id ?? "none"} label={task.name} entries={task.entries} seconds={task.seconds} indent={2} />
                  ))}
                </View>
              ))}
          </View>
        ))}
        <SummaryRow label="Total" entries={summary.totalEntries} seconds={summary.totalSeconds} indent={0} bold />

        {includePerson && summary.people.length > 1 && (
          <View wrap={false}>
            <Text style={s.h2}>Por pessoa</Text>
            <SummaryHeader first="Pessoa" />
            {summary.people.map((p) => (
              <SummaryRow key={p.id} label={p.name} entries={p.entries} seconds={p.seconds} indent={0} />
            ))}
          </View>
        )}
        <Footer generatedAt={stamp} />
      </Page>

      {rows.length > 0 && (
        <Page size="A4" orientation="landscape" style={s.page}>
          <Banner title="Registros" subtitle={`Período: ${period}`} />
          <View style={[s.th, s.gridEdge, { marginTop: 8 }]} fixed>
            <Text style={[s.thText, s.hcell, { width: 96 }]}>Início</Text>
            {includePerson && <Text style={[s.thText, s.hcell, { width: 80 }]}>Pessoa</Text>}
            <Text style={[s.thText, s.hcell, { width: 150 }]}>Cliente / projeto</Text>
            <Text style={[s.thText, s.hcell, { width: 110 }]}>Tarefa</Text>
            <Text style={[s.thText, s.hcell, { flex: 1 }]}>Descrição</Text>
            <Text style={[s.thText, s.hcell, s.num, { width: 56 }]}>Duração</Text>
            <Text style={[s.thText, s.num, { width: 40, paddingHorizontal: 4 }]}>Horas</Text>
          </View>
          {rows.map((e, i) => (
            <View key={i} style={[s.row, s.gridEdge, { paddingVertical: 0 }]} wrap={false}>
              <View style={[s.cell, { width: 96 }]}>
                <Text>{formatDateBr(e.date).slice(0, 5)}</Text>
                <Text style={s.muted}>{formatTimeSpan(e)}</Text>
              </View>
              {includePerson && <Text style={[s.cell, { width: 80 }]}>{e.person}</Text>}
              <View style={[s.cell, { width: 150 }]}>
                <Text>{e.project}</Text>
                {e.client !== "" && <Text style={s.muted}>{e.client}</Text>}
              </View>
              <Text style={[s.cell, { width: 110 }]}>{e.task}</Text>
              <Text style={[s.cell, { flex: 1 }]}>{e.description}</Text>
              <Text style={[s.cell, s.num, { width: 56 }]}>{formatHms(e.seconds)}</Text>
              <Text style={[s.num, { width: 40, paddingHorizontal: 4, paddingVertical: 2.5 }]}>{hours(e.seconds)}</Text>
            </View>
          ))}
          <Footer generatedAt={stamp} />
        </Page>
      )}
    </Document>
  );
}

/** One A4 portrait page of totals (client > project > task, per person) followed by the entry list in landscape. */
export async function buildPdf(input: Input): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<ReportDocument {...input} />));
}
