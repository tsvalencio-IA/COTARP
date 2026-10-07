package br.com.thiaguinhosolucoes.transcritor;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private EditText keyEdit, transcript;
    private TextView status,fileInfo;
    private Button transcribe;
    private Uri mediaUri;
    private String mediaName="audio_whatsapp.ogg", mediaMime="audio/ogg";
    private static final int REQ_AUDIO=77;

    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        buildUi();
        keyEdit.setText(SecureKeyStore.load(this));
        requestAudioPermissionIfNeeded();
        handleIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent); setIntent(intent); handleIntent(intent);
    }

    public static boolean hasAudioPermission(android.content.Context c){
        if(Build.VERSION.SDK_INT>=33) return c.checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO)==PackageManager.PERMISSION_GRANTED;
        return c.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)==PackageManager.PERMISSION_GRANTED;
    }

    private void requestAudioPermissionIfNeeded(){
        if(hasAudioPermission(this)) return;
        if(Build.VERSION.SDK_INT>=33) requestPermissions(new String[]{Manifest.permission.READ_MEDIA_AUDIO},REQ_AUDIO);
        else requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE},REQ_AUDIO);
    }

    private void buildUi(){
        int navy=Color.rgb(13,23,38), blue=Color.rgb(47,128,237), dark=Color.rgb(22,36,58);
        ScrollView scroll=new ScrollView(this); scroll.setBackgroundColor(navy);
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(16),dp(18),dp(16),dp(30)); scroll.addView(root);
        TextView title=txt("TRANSCRITOR IA",26,true); title.setTextColor(Color.WHITE); root.addView(title);
        TextView sub=txt("Android v1.3 • botão direto sobre o WhatsApp",14,false); sub.setTextColor(Color.LTGRAY); sub.setPadding(0,0,0,dp(16)); root.addView(sub);

        LinearLayout direct=card(dark); root.addView(direct);
        direct.addView(txt("USAR DIRETO NO WHATSAPP",18,true));
        TextView explain=txt("1. Conceda acesso aos áudios.\n2. Ative o Transcritor IA em Acessibilidade.\n3. Volte ao WhatsApp: aparecerá o botão 🎙 IA.",14,false);
        explain.setTextColor(Color.LTGRAY); explain.setPadding(0,dp(8),0,dp(8)); direct.addView(explain);
        Button perm=btn("PERMITIR ACESSO AOS ÁUDIOS",blue); perm.setOnClickListener(v->requestAudioPermissionIfNeeded()); direct.addView(perm);
        Button acc=btn("ATIVAR BOTÃO NO WHATSAPP",blue); acc.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))); direct.addView(acc);

        LinearLayout keyCard=card(dark); root.addView(keyCard);
        keyCard.addView(txt("Chave Groq",17,true));
        keyEdit=new EditText(this); keyEdit.setHint("gsk_..."); keyEdit.setTextColor(Color.WHITE); keyEdit.setHintTextColor(Color.GRAY);
        keyEdit.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD); keyCard.addView(keyEdit);
        LinearLayout keyRow=row();
        Button save=btn("SALVAR",blue); save.setOnClickListener(v->saveKey()); keyRow.addView(save,weight());
        Button test=btn("TESTAR",dark); test.setOnClickListener(v->testKey()); keyRow.addView(test,weight());
        keyCard.addView(keyRow);

        LinearLayout media=card(dark); root.addView(media);
        media.addView(txt("Modo alternativo",17,true));
        fileInfo=txt("Você ainda pode compartilhar ou selecionar um áudio manualmente, mas não é necessário para o uso direto no WhatsApp.",13,false);
        fileInfo.setTextColor(Color.LTGRAY); media.addView(fileInfo);
        Button select=btn("SELECIONAR ÁUDIO / VÍDEO",blue); select.setOnClickListener(v->pick()); media.addView(select);
        transcribe=btn("TRANSCREVER AGORA",blue); transcribe.setOnClickListener(v->start()); media.addView(transcribe);
        status=txt("Pronto.",13,false); status.setTextColor(Color.LTGRAY); media.addView(status);

        LinearLayout result=card(dark); root.addView(result);
        result.addView(txt("Transcrição",17,true));
        transcript=new EditText(this); transcript.setMinLines(8); transcript.setGravity(Gravity.TOP); transcript.setTextColor(Color.WHITE); transcript.setHintTextColor(Color.GRAY);
        transcript.setHint("O texto aparecerá aqui."); transcript.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE); result.addView(transcript,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout actions=row();
        Button copy=btn("COPIAR",blue); copy.setOnClickListener(v->copy()); actions.addView(copy,weight());
        Button share=btn("COMPARTILHAR",blue); share.setOnClickListener(v->share()); actions.addView(share,weight());
        Button clear=btn("APAGAR",Color.rgb(150,45,45)); clear.setOnClickListener(v->{transcript.setText("");status.setText("Transcrição apagada.");}); actions.addView(clear,weight());
        result.addView(actions);

        TextView foot=txt("Powered by thIAguinho Soluções Digitais",12,true); foot.setTextColor(Color.LTGRAY); foot.setGravity(Gravity.CENTER); foot.setPadding(0,dp(18),0,0); root.addView(foot);
        setContentView(scroll);
    }

    private void handleIntent(Intent intent){
        if(intent==null||!Intent.ACTION_SEND.equals(intent.getAction())) return;
        Uri uri=intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if(uri==null) return;
        mediaUri=uri; mediaMime=intent.getType()==null?"audio/ogg":intent.getType(); mediaName=queryName(uri);
        fileInfo.setText("Recebido: "+mediaName);
        if(!keyEdit.getText().toString().trim().isEmpty()) start();
        else status.setText("Áudio recebido. Salve sua chave Groq para transcrever.");
    }

    private void pick(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*"); i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"audio/*","video/*"}); startActivityForResult(i,33);
    }
    @Override protected void onActivityResult(int req,int res,Intent data){
        super.onActivityResult(req,res,data);
        if(req==33&&res==RESULT_OK&&data!=null&&data.getData()!=null){
            mediaUri=data.getData(); mediaMime=getContentResolver().getType(mediaUri); mediaName=queryName(mediaUri); fileInfo.setText(mediaName);
        }
    }

    private void saveKey(){
        String k=keyEdit.getText().toString().trim();
        if(k.isEmpty()){toast("Informe a chave Groq.");return;}
        try{SecureKeyStore.save(this,k);toast("Chave salva com segurança.");}catch(Exception e){toast("Falha ao salvar: "+e.getMessage());}
    }
    private void testKey(){
        final String k=keyEdit.getText().toString().trim(); if(k.isEmpty()){toast("Informe a chave.");return;}
        status.setText("Testando chave…");
        executor.execute(()->{try{GroqApi.test(k);SecureKeyStore.save(this,k);ui(()->status.setText("Chave Groq válida."));}catch(Exception e){ui(()->status.setText("Erro: "+e.getMessage()));}});
    }

    private void start(){
        if(mediaUri==null){toast("Selecione ou compartilhe um áudio.");return;}
        final String key=keyEdit.getText().toString().trim(); if(key.isEmpty()){toast("Informe e salve a chave Groq.");return;}
        try{SecureKeyStore.save(this,key);}catch(Exception ignored){}
        transcribe.setEnabled(false); status.setText("Transcrevendo…"); transcript.setText("Transcrevendo…");
        final Uri uri=mediaUri; final String name=mediaName, mime=mediaMime;
        executor.execute(()->{
            try{
                String text=GroqApi.transcribe(this,uri,name,mime,key);
                ui(()->{transcript.setText(text);status.setText("Concluído.");transcribe.setEnabled(true);});
            }catch(Exception e){
                ui(()->{transcript.setText("");status.setText("Erro: "+e.getMessage());transcribe.setEnabled(true);});
            }
        });
    }

    private String queryName(Uri u){
        try(Cursor c=getContentResolver().query(u,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
            if(c!=null&&c.moveToFirst()){int i=c.getColumnIndex(OpenableColumns.DISPLAY_NAME);if(i>=0)return c.getString(i);}
        }catch(Exception ignored){}
        return "audio_whatsapp.ogg";
    }
    private void copy(){
        ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Transcrição",transcript.getText().toString()));
        toast("Copiado.");
    }
    private void share(){
        Intent i=new Intent(Intent.ACTION_SEND);i.setType("text/plain");i.putExtra(Intent.EXTRA_TEXT,transcript.getText().toString());startActivity(Intent.createChooser(i,"Compartilhar transcrição"));
    }

    private LinearLayout card(int color){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.setPadding(dp(14),dp(14),dp(14),dp(14));l.setBackgroundColor(color);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,0,0,dp(14));l.setLayoutParams(p);return l;}
    private LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);return l;}
    private LinearLayout.LayoutParams weight(){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(50),1);p.setMargins(dp(3),dp(8),dp(3),0);return p;}
    private TextView txt(String s,int size,boolean bold){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(Color.WHITE);if(bold)v.setTypeface(null,android.graphics.Typeface.BOLD);return v;}
    private Button btn(String s,int color){Button b=new Button(this);b.setText(s);b.setTextColor(Color.WHITE);b.setBackgroundColor(color);return b;}
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    private void ui(Runnable r){runOnUiThread(r);}
}
