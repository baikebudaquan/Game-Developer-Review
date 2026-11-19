import type { APIRoute } from 'astro';
import { index, manifest, taxonomy, detail } from '../../../lib/data';

export function getStaticPaths() {
  const entries = [
    { name: 'index', value: index }, { name: 'manifest', value: manifest },
    { name: 'taxonomy', value: taxonomy },
    ...index.companies.map(company => ({ name: 'companies/' + company.id, value: detail(company.id) })),
  ];
  return entries.map(({ name, value }) => ({ params: { name }, props: { value } }));
}
export const GET: APIRoute = ({ props }) => new Response(JSON.stringify(props.value), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
