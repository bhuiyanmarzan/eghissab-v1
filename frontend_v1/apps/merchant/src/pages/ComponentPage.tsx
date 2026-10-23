import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../lib/localization';
import { useState } from 'react';
import { AlertCircle, Bell, Check, ChevronRight, CircleUser, Heart, Info, LoaderCircle, Minus, Search, Star, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, Input, Progress, Select } from '../components/ui/primitives';
import { titleFromPath } from '../lib/utils';

const samples = ['autocomplete','buttons','checkbox','radio','rating','switch','select','slider','textfield','avatars','badges','chips','lists','tooltip','typography','alert','dialogs','progress','snackbar','breadcrumbs','pagination','speeddial','stepper','tabs','accordion','cards','color','date-time-picker','modal','shadows','timeline','treeview'];

export function ComponentsOverview(){
  useTranslation(); return <div><div className="mb-6"><p className="max-w-2xl text-sm text-muted">{translateNode("A practical collection of accessible enterprise components used throughout the application.")}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{samples.map((sample,i)=><a href={`/components-overview/${sample}`} key={sample}><Card className="group grid h-40 place-items-center p-5 text-center transition hover:border-primary hover:shadow-md"><ComponentPreview index={i}/><p className="mt-3 text-sm font-medium capitalize">{translateNode(sample.replace('-',' '))}</p></Card></a>)}</div></div> }

function ComponentPreview({index}:{index:number}) {
  useTranslation(); const icons=[Search,Check,Star,Minus,CircleUser,Bell,Heart,AlertCircle,LoaderCircle,ChevronRight]; const Icon=icons[index%icons.length]; return <div className="grid size-16 place-items-center rounded-lg bg-subtle text-slate-400 transition group-hover:bg-primary-soft group-hover:text-primary"><Icon className="size-8"/></div> }

export function ComponentPage({ type }: { type: string }) {
  useTranslation();
  const [open,setOpen]=useState(true); const [tab,setTab]=useState('General'); const [rating,setRating]=useState(4);
  return <div className="grid gap-5 lg:grid-cols-2"><Demo title={translateString(`${titleFromPath(type)} - Basic`)}><RenderSample type={type} open={open} setOpen={setOpen} tab={tab} setTab={setTab} rating={rating} setRating={setRating}/></Demo><Demo title={translateString(`${titleFromPath(type)} - Variants`)}><RenderVariants type={type}/></Demo><Demo title={translateString("Sizes and States")}><RenderSample type={type} open={open} setOpen={setOpen} tab={tab} setTab={setTab} rating={rating} setRating={setRating}/></Demo><Demo title={translateString("Usage")}><p className="text-sm leading-7 text-muted">{translateNode("Components use accessible labels, visible focus states, keyboard interactions, consistent spacing, and application design tokens. Use these building blocks to keep new features aligned with the dashboard.")}</p></Demo></div>;
}

function Demo({title,children}:{title:string;children:React.ReactNode}) {
  useTranslation(); return <Card><CardHeader title={translateString(title)}/><CardContent className="min-h-40">{translateNode(children)}</CardContent></Card> }

function RenderSample({type,open,setOpen,tab,setTab,rating,setRating}:{type:string;open:boolean;setOpen:(v:boolean)=>void;tab:string;setTab:(v:string)=>void;rating:number;setRating:(v:number)=>void}) {
  useTranslation();
  if(type.includes('button')) return <div className="flex flex-wrap gap-3"><Button>{translateNode("Primary")}</Button><Button variant="outline">{translateNode("Outlined")}</Button><Button variant="ghost">{translateNode("Text")}</Button><Button variant="danger">{translateNode("Delete")}</Button></div>;
  if(['textfield','autocomplete'].includes(type)) return <div className="space-y-3"><Input placeholder={translateString("Default field")}/><Input placeholder={translateString("Search options...")}/><Input disabled value={translateString("Disabled")}/></div>;
  if(type==='select') return <Select className="w-full"><option value="Select an option">{translateNode("Select an option")}</option><option value="Option one">{translateNode("Option one")}</option><option value="Option two">{translateNode("Option two")}</option></Select>;
  if(['checkbox','radio','switch'].includes(type)) return <div className="space-y-3">{['Default','Checked','Disabled'].map((label,i)=><label key={label} className="flex items-center gap-3 text-sm"><input type={type==='radio'?'radio':'checkbox'} name={type} defaultChecked={i===1} disabled={i===2} className={type==='switch'?'switch':'size-4 accent-primary'}/>{translateNode(label)}</label>)}</div>;
  if(type==='rating') return <div className="flex gap-1">{[1,2,3,4,5].map((n)=><button key={n} onClick={()=>setRating(n)}><Star className={`size-7 text-warning ${n<=rating?'fill-current':''}`}/></button>)}</div>;
  if(type==='slider') return <input type="range" defaultValue="65" className="w-full accent-primary"/>;
  if(type==='avatars') return <div className="flex items-center gap-4"><Avatar name="John Doe" size="sm"/><Avatar name="Sarah Parker"/><Avatar name="Alex Chen" size="lg"/></div>;
  if(['badges','chips'].includes(type)) return <div className="flex flex-wrap gap-2"><Badge>{translateNode("Primary")}</Badge><Badge tone="green">{translateNode("Success")}</Badge><Badge tone="amber">{translateNode("Warning")}</Badge><Badge tone="red">{translateNode("Error")}</Badge></div>;
  if(type==='alert') return <div className="space-y-3">{[["bg-primary-soft text-primary",Info,'There is a new version available.'],["bg-green-50 text-green-700",Check,'Your changes have been saved.'],["bg-red-50 text-red-700",AlertCircle,'Something needs your attention.']].map(([tone,Icon,text]:any)=><div className={`flex gap-3 rounded-md border p-3 ${tone}`} key={text}><Icon className="size-5"/><span className="text-sm">{translateNode(text)}</span></div>)}</div>;
  if(type==='progress') return <div className="space-y-5"><Progress value={28}/><Progress value={64} tone="green"/><Progress value={87} tone="amber"/></div>;
  if(['dialogs','modal','snackbar'].includes(type)) return <div><Button onClick={()=>setOpen(true)}>{translateNode("Open ")}{translateNode(titleFromPath(type))}</Button>{open&&<div className="mt-4 rounded-md border border-border bg-subtle p-4"><div className="flex"><strong>{translateNode("Confirm action")}</strong><button onClick={()=>setOpen(false)} className="ms-auto"><X className="size-4"/></button></div><p className="mt-2 text-sm text-muted">{translateNode("This is an interactive component preview.")}</p></div>}</div>;
  if(type==='tabs') return <div><div className="flex border-b border-border">{['General','Security','Billing'].map((item)=><button key={item} onClick={()=>setTab(item)} className={`border-b-2 px-4 py-2 text-sm ${tab===item?'border-primary text-primary':'border-transparent'}`}>{translateNode(item)}</button>)}</div><p className="p-4 text-sm text-muted">{translateNode(tab)} {translateNode("settings content")}</p></div>;
  if(type==='accordion') return <div className="divide-y divide-border rounded-md border border-border">{['What is Mantis?','How do I connect an API?','Can I change the theme?'].map((q,i)=><details key={q} open={i===0} className="p-3"><summary className="cursor-pointer text-sm font-medium">{translateNode(q)}</summary><p className="pt-2 text-sm text-muted">{translateNode("Reusable content for this accordion item.")}</p></details>)}</div>;
  if(type==='typography') return <div><h2 className="text-3xl font-bold">{translateNode("Heading 1")}</h2><h3 className="mt-2 text-xl font-semibold">{translateNode("Heading 2")}</h3><p className="mt-3 text-sm leading-6 text-muted">{translateNode("Body text is optimized for dense enterprise interfaces.")}</p></div>;
  if(type==='color') return <div className="grid grid-cols-5 gap-2">{['var(--color-primary)','#13c2c2','#52c41a','#faad14','#ff4d4f','#722ed1','#262626','#8c8c8c','#f0f2f5','#ffffff'].map((c)=><div key={c}><span className="block aspect-square rounded-md border border-border" style={{background:c}}/><small className="text-[10px]">{translateNode(c)}</small></div>)}</div>;
  if(type==='cards') return <Card className="p-4"><strong>{translateNode("Project overview")}</strong><p className="mt-2 text-sm text-muted">{translateNode("A compact card with useful content and one clear action.")}</p><Button size="sm" className="mt-4">{translateNode("View project")}</Button></Card>;
  if(type.includes('date')) return <Input type="datetime-local" defaultValue="2026-09-30T10:30"/>;
  return <div className="space-y-3">{['Application','Documents','Customers'].map((label,i)=><div className="flex items-center gap-3 rounded-md border border-border p-3" key={label}><ComponentPreview index={i}/><span className="text-sm font-medium">{translateNode(label)}</span><ChevronRight className="ms-auto size-4 text-muted"/></div>)}</div>;
}

function RenderVariants({type}:{type:string}) {
  useTranslation(); return <div className="space-y-4"><p className="text-sm text-muted">{translateNode("Common ")}{translateNode(titleFromPath(type).toLowerCase())} {translateNode("variants")}</p><div className="flex flex-wrap gap-3"><Button size="sm">{translateNode("Small")}</Button><Button>{translateNode("Default")}</Button><Button variant="outline">{translateNode("Outline")}</Button><Button disabled>{translateNode("Disabled")}</Button></div></div> }
