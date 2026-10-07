package br.com.thiaguinhosolucoes.transcritor;

import android.accessibilityservice.AccessibilityService;
import android.content.*;
import android.database.Cursor;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.view.*;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;

public class WhatsAppAccessibilityService extends AccessibilityService {
    private WindowManager wm;
    private TextView bubble;
    private WindowManager.LayoutParams bubbleParams;
    private View resultPanel;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private volatile int lastDurationSec=-1;
    private static final Pattern DURATION=Pattern.compile("(?<!\\d)(\\d{1,2}):(\\d{2})(?!\\d)");

    @Override public void onServiceConnected(){
        super.onServiceConnected();
        wm=(WindowManager)getSystemService(WINDOW_SERVICE);
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event){
        if(event==null) return;
        CharSequence pkg=event.getPackageName();
        boolean whats="com.whatsapp".contentEquals(pkg)||"com.whatsapp.w4b".contentEquals(pkg);
        if(whats){
            captureDuration(event.getSource());
            showBubble();
        }else{
            hideBubble();
            hidePanel();
        }
    }

    @Override public void onInterrupt(){}

    private void captureDuration(AccessibilityNodeInfo source){
        if(source==null) return;
        try{
            AccessibilityNodeInfo node=source;
            for(int level=0; level<3 && node!=null; level++){
                int d=findDuration(node);
                if(d>0){ lastDurationSec=d; return; }
                node=node.getParent();
            }
        }catch(Exception ignored){}
    }

    private int findDuration(AccessibilityNodeInfo node){
        if(node==null) return -1;
        ArrayDeque<AccessibilityNodeInfo> q=new ArrayDeque<>();
        q.add(node); int seen=0;
        while(!q.isEmpty() && seen<40){
            AccessibilityNodeInfo n=q.removeFirst(); seen++;
            int d=parseDuration(n.getText());
            if(d<0) d=parseDuration(n.getContentDescription());
            if(d>0) return d;
            for(int i=0;i<n.getChildCount();i++){
                AccessibilityNodeInfo c=n.getChild(i);
                if(c!=null) q.addLast(c);
            }
        }
        return -1;
    }

    private int parseDuration(CharSequence s){
        if(s==null) return -1;
        Matcher m=DURATION.matcher(s.toString());
        if(!m.find()) return -1;
        try{
            int min=Integer.parseInt(m.group(1)), sec=Integer.parseInt(m.group(2));
            if(sec>59) return -1;
            return min*60+sec;
        }catch(Exception e){ return -1; }
    }

    private void showBubble(){
        if(bubble!=null) return;
        bubble=new TextView(this);
        bubble.setText("🎙 IA");
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(15);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(dp(12),0,dp(12),0);
        bubble.setTypeface(null,Typeface.BOLD);
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.rgb(47,128,237)); bg.setCornerRadius(dp(24));
        bg.setStroke(dp(1),Color.WHITE);
        bubble.setBackground(bg);
        bubble.setOnClickListener(v->transcribeCurrent());
        bubble.setOnLongClickListener(v->{ openApp(); return true; });

        int type=WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
        bubbleParams=new WindowManager.LayoutParams(dp(76),dp(48),type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        bubbleParams.gravity=Gravity.END|Gravity.CENTER_VERTICAL;
        bubbleParams.x=dp(8); bubbleParams.y=0;
        try{wm.addView(bubble,bubbleParams);}catch(Exception ignored){bubble=null;}
    }

    private void hideBubble(){
        if(bubble!=null){
            try{wm.removeView(bubble);}catch(Exception ignored){}
            bubble=null;
        }
    }

    private void transcribeCurrent(){
        String key=SecureKeyStore.load(this);
        if(key.isEmpty()){ showMessage("Configure sua chave Groq no Transcritor IA."); openApp(); return; }
        if(!MainActivity.hasAudioPermission(this)){
            showMessage("Permita acesso aos áudios no Transcritor IA.");
            openApp();
            return;
        }
        showResult("Transcrevendo…",false);
        final int wanted=lastDurationSec;
        executor.execute(()->{
            try{
                AudioItem item=findWhatsAppAudio(wanted);
                if(item==null) throw new Exception("Não encontrei o áudio do WhatsApp no aparelho.");
                String text=GroqApi.transcribe(this,item.uri,item.name,item.mime,key);
                new Handler(Looper.getMainLooper()).post(()->showResult(text.isEmpty()?"Não foi possível obter texto.":text,true));
            }catch(Exception e){
                new Handler(Looper.getMainLooper()).post(()->showResult("Erro: "+e.getMessage(),true));
            }
        });
    }

    private AudioItem findWhatsAppAudio(int wantedDuration){
        Uri collection=MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection;
        String selection=null;
        String[] args=null;
        if(Build.VERSION.SDK_INT>=29){
            projection=new String[]{
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.RELATIVE_PATH
            };
            selection="("+MediaStore.Audio.Media.RELATIVE_PATH+" LIKE ? OR "+MediaStore.Audio.Media.DISPLAY_NAME+" LIKE ? OR "+MediaStore.Audio.Media.DISPLAY_NAME+" LIKE ?)";
            args=new String[]{"%WhatsApp%","PTT-%","AUD-%"};
        }else{
            projection=new String[]{
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.MIME_TYPE,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.DATA
            };
            selection="("+MediaStore.Audio.Media.DATA+" LIKE ? OR "+MediaStore.Audio.Media.DISPLAY_NAME+" LIKE ? OR "+MediaStore.Audio.Media.DISPLAY_NAME+" LIKE ?)";
            args=new String[]{"%WhatsApp%","PTT-%","AUD-%"};
        }

        AudioItem fallback=null;
        try(Cursor c=getContentResolver().query(collection,projection,selection,args,MediaStore.Audio.Media.DATE_ADDED+" DESC")){
            if(c==null) return null;
            int idIx=c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
            int nameIx=c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
            int mimeIx=c.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE);
            int durIx=c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
            int count=0;
            while(c.moveToNext() && count<80){
                count++;
                long id=c.getLong(idIx);
                String name=c.getString(nameIx);
                String mime=c.getString(mimeIx);
                long durMs=c.getLong(durIx);
                AudioItem item=new AudioItem(ContentUris.withAppendedId(collection,id),name,mime,durMs);
                if(fallback==null) fallback=item;
                if(wantedDuration>0 && Math.abs((durMs/1000)-wantedDuration)<=1) return item;
            }
        }catch(Exception ignored){}
        return fallback;
    }

    private void showResult(String text,boolean actions){
        hidePanel();
        LinearLayout box=new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16),dp(14),dp(16),dp(12));
        GradientDrawable bg=new GradientDrawable();
        bg.setColor(Color.rgb(22,36,58)); bg.setCornerRadius(dp(18)); bg.setStroke(dp(1),Color.rgb(47,128,237));
        box.setBackground(bg);

        TextView title=new TextView(this); title.setText("TRANSCRITOR IA"); title.setTextColor(Color.WHITE); title.setTextSize(16); title.setTypeface(null,Typeface.BOLD); box.addView(title);
        TextView body=new TextView(this); body.setText(text); body.setTextColor(Color.WHITE); body.setTextSize(15); body.setPadding(0,dp(10),0,dp(10)); body.setTextIsSelectable(true);
        ScrollView sc=new ScrollView(this); sc.addView(body); box.addView(sc,new LinearLayout.LayoutParams(dp(300),dp(220)));

        LinearLayout row=new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
        if(actions){
            Button copy=new Button(this); copy.setText("COPIAR"); copy.setOnClickListener(v->{
                ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Transcrição",body.getText()));
                Toast.makeText(this,"Copiado.",Toast.LENGTH_SHORT).show();
            });
            row.addView(copy,new LinearLayout.LayoutParams(0,dp(46),1));
        }
        Button close=new Button(this); close.setText(actions?"APAGAR":"FECHAR"); close.setOnClickListener(v->hidePanel());
        row.addView(close,new LinearLayout.LayoutParams(0,dp(46),1));
        box.addView(row);

        WindowManager.LayoutParams p=new WindowManager.LayoutParams(dp(332),dp(330),WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        p.gravity=Gravity.CENTER;
        resultPanel=box;
        try{wm.addView(resultPanel,p);}catch(Exception e){resultPanel=null;}
    }

    private void showMessage(String msg){ showResult(msg,true); }
    private void hidePanel(){
        if(resultPanel!=null){ try{wm.removeView(resultPanel);}catch(Exception ignored){} resultPanel=null; }
    }

    private void openApp(){
        Intent i=new Intent(this,MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
    }

    @Override public void onDestroy(){
        hideBubble(); hidePanel(); executor.shutdownNow(); super.onDestroy();
    }

    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private static final class AudioItem{
        final Uri uri; final String name,mime; final long duration;
        AudioItem(Uri u,String n,String m,long d){uri=u;name=n;mime=m==null?"audio/ogg":m;duration=d;}
    }
}
