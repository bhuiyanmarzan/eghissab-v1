import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../lib/localization';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Check, Clipboard, CloudUpload, Eye, EyeOff, Save } from 'lucide-react';
import { z } from 'zod';
import { Button, Card, CardContent, CardHeader, Input, Select } from '../components/ui/primitives';

const schema = z.object({
  firstName: z.string().min(2, 'Enter at least 2 characters'), lastName: z.string().min(2, 'Enter at least 2 characters'),
  email: z.email('Enter a valid email'), phone: z.string().min(8, 'Enter a valid phone number'), company: z.string().min(2, 'Enter at least 2 characters'), country: z.string().min(2, 'Enter at least 2 characters'),
});
type FormValues = z.infer<typeof schema>;

const fields: {name:keyof FormValues;label:string;type?:string}[] = [
  {name:'firstName',label:'First name'}, {name:'lastName',label:'Last name'}, {name:'email',label:'Email address',type:'email'},
  {name:'phone',label:'Phone number'}, {name:'company',label:'Company'}, {name:'country',label:'Country'},
];

export function FormPage({ kind = 'basic' }: { kind?: string }) {
  useTranslation();
  const [saved,setSaved]=useState(false);
  const {register,handleSubmit,formState:{errors},reset}=useForm<FormValues>({resolver:zodResolver(schema),defaultValues:{firstName:'John',lastName:'Doe',email:'john.doe@example.com',phone:'+1 234 567 890',company:'Mantis Inc.',country:'United States'}});
  const onSubmit=()=>{setSaved(true);setTimeout(()=>setSaved(false),2500)};
  if(kind==='dropzone') return <Card><CardHeader title={translateString("Upload Files")}/><CardContent><label className="grid min-h-72 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-blue-200 bg-primary-soft/30 text-center"><input type="file" multiple className="sr-only"/><span><CloudUpload className="mx-auto size-12 text-primary"/><strong className="mt-4 block">{translateNode("Drag & drop files here")}</strong><small className="mt-2 block text-muted">{translateNode("or click to browse from your computer")}</small></span></label></CardContent></Card>;
  if(kind==='editor') return <Card><CardHeader title={translateString("Document Editor")}/><div className="flex flex-wrap gap-1 border-b border-border p-3">{['B','I','U','H1','H2','• List','1. List','Link'].map((tool)=><Button key={tool} variant="ghost" size="sm">{translateNode(tool)}</Button>)}</div><CardContent><textarea className="min-h-96 w-full resize-y rounded-md border border-border p-4 text-sm leading-7 outline-none focus:border-primary" defaultValue={'Start writing your content here...\n\nThis editor is ready to connect to the rich-text library of your choice.'}/></CardContent></Card>;
  if(kind==='clipboard') return <div className="grid gap-5 lg:grid-cols-2">{['Basic Copy','Copy from Textarea'].map((title,i)=><Card key={title}><CardHeader title={translateString(title)}/><CardContent><div className="flex gap-2">{i===0?<Input id={`copy-${i}`} defaultValue="https://mantis.example/dashboard"/>:<textarea id={`copy-${i}`} className="h-24 flex-1 rounded-md border border-border p-3 text-sm">{translateNode("Copy this reusable content to the clipboard.")}</textarea>}<Button variant="outline" size="icon" onClick={()=>navigator.clipboard?.writeText((document.getElementById(`copy-${i}`) as HTMLInputElement)?.value || '')}><Clipboard className="size-4"/></Button></div></CardContent></Card>)}</div>;
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5"><Card><CardHeader title={translateString(kind==='wizard'?'Account Information':'Personal Information')}/><CardContent className="grid gap-5 md:grid-cols-2">{fields.map((field)=><label key={field.name} className={kind==='basic'&&field.name==='email'?'md:col-span-2':''}><span className="mb-2 block text-sm font-medium">{translateNode(field.label)}</span><Input type={field.type} {...register(field.name)}/>{errors[field.name]&&<span className="mt-1 block text-xs text-danger">{translateNode(errors[field.name]?.message)}</span>}</label>)}<label><span className="mb-2 block text-sm font-medium">{translateNode("Role")}</span><Select className="w-full"><option value="Administrator">{translateNode("Administrator")}</option><option value="Manager">{translateNode("Manager")}</option><option value="Viewer">{translateNode("Viewer")}</option></Select></label><label><span className="mb-2 block text-sm font-medium">{translateNode("Status")}</span><Select className="w-full"><option value="Active">{translateNode("Active")}</option><option value="Inactive">{translateNode("Inactive")}</option></Select></label></CardContent></Card><Card><CardHeader title={translateString("Preferences")}/><CardContent className="space-y-4">{['Send me product updates','Email me weekly reports','Enable two-factor authentication'].map((label,i)=><label className="flex items-center gap-3 text-sm" key={label}><input type="checkbox" defaultChecked={i<2} className="size-4 accent-primary"/>{translateNode(label)}</label>)}</CardContent></Card><div className="sticky bottom-0 flex justify-end gap-3 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur"><Button type="button" variant="outline" onClick={()=>reset()}>{translateNode("Reset")}</Button><Button type="submit">{saved?<Check className="size-4"/>:<Save className="size-4"/>}{translateNode(saved?'Saved':'Save Changes')}</Button></div></form>;
}

export function PasswordForm(){
  useTranslation(); const [show,setShow]=useState(false); return <Card className="mx-auto max-w-2xl"><CardHeader title={translateString("Change Password")}/><CardContent className="space-y-5">{['Current Password','New Password','Confirm Password'].map((label)=><label key={label}><span className="mb-2 block text-sm font-medium">{translateNode(label)}</span><div className="relative"><Input type={show?'text':'password'} defaultValue="password123"/><Button variant="ghost" size="icon" className="absolute end-1 top-0.5" onClick={()=>setShow(!show)}>{show?<EyeOff className="size-4"/>:<Eye className="size-4"/>}</Button></div></label>)}<Button className="w-full">{translateNode("Update Password")}</Button></CardContent></Card> }
