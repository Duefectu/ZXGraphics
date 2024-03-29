// @ts-check

// This script is run within the webview itself
(function () {
	// @ts-ignore
	const vscode = acquireVsCodeApi();

	class Pattern {		
		constructor(){
			this.Points=[ 
				0,0,0,0,0,0,0,0, 
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
				0,0,0,0,0,0,0,0,
			];				
		}
	}


	class FullPoint{
		constructor(){
			this.x=0;
			this.y=0;
			this.idPattern=0;
			this.value=0;
			this.idx=0;
		}

		static GetData(x,y){
			let idPX=parseInt(x/8);
			let idPY=parseInt(y/8);
			let data=new FullPoint();
			data.idPattern=editor.selectedPattern+idPX+(idPY*editor.patternWidth);
			data.x=x % 8;
			data.y=y % 8;
			data.idx=data.x+(data.y*8);
			data.value=editor.patterns[data.idPattern].Points[data.idx];
			return data;
		}

		static SetData(x,y,value){
			let d=FullPoint.GetData(x,y);
			let v=editor.patterns[d.idPattern].Points[d.idx];
			editor.patterns[d.idPattern].Points[d.idx]=value;
			d.value=v;
			return d;
		}

		static SetTempData(x,y,value){
			let d=FullPoint.GetData(x,y);
			let v=editor.patterns[d.idPattern].Points[d.idx];
			editor.backPatterns[d.idPattern].Points[d.idx]=value;
			d.value=v;
			return d;
		}
	}

	
	class GDU_Editor {
		constructor() {
			console.debug("GDU_Editor");
			this.scales=[ 1, 2, 4, 8, 16, 24, 32, 48, 64 ];
			this.selectedPattern=0;			// Selected pattern
			this.patternMode=0;				// Pattern editing mode: 0=GDU, 1=Font, 2=Free(256)
			this.patternWidth=1;			// Width of editing patterns
			this.patternHeight=1;			// Height of editing patterns
			this.patternsCount=0;			// Number of patterns in the file
			this.zoom=32;					// Zoom level
			this.frameStart=0;				// First frame for animation
			this.framesLength=1;			// Number of frames to animate
			this.framesActual=0;			// Actual frame for animation
			this.inkColor=0;				// Main color
			this.paperColor=7;				// Secondary color
			this.bright=0;					// Bright color

			//this.divPatternsMain=document.querySelector('#divPatternsMain');
			this.patterns=new Array;		// Patterns
			this.editorClicks=new Array;	// Clicks on editor for UNDO and REDO
			this.backPatterns=new Array;	// Void pattern for rotate operatioons

			this.mouseX=0;					// Mouse X
			this.mouseY=0;					// Mouse Y
			this.mouseIdPattern=0;			// Mouse pattern
			this.mouseButton=0;				// Mouse button: 1=Left, 2=Wheel, 3=Right
			this.mouseDown=0;				// Mouse button is down: 0=No, 1=Yes
			this.mouseColor=0;				// Mouse color for click and move
			this.mouseLastX=0;				// Last mouse X
			this.mouseLastY=0;				// Last mouse Y
			this.mouseLastIdPattern=0;		// Last pattern id

			this.lastZoom=0;				// Used to manage onchange event
			this.lastWidth=0;				// Used to manage onchange event
			this.lastHeight=0;				// Used to manage onchange event

			this.colorsULA=[				// Standar ULA (ZX Spectrum classic) colors
				"#000000", "#0000c0", "#c00000", "#c000c0", "#00c000", "#00c0c0", "#c0c000", "#c0c0c0",
				"#000000", "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#ffffff",
			];
			this.palette=[];				// Active palette
			
			this.selector="";
			this.modal="";					// Active modal

			this.copyIdPattern=-1;			// First IdPattern of the copy buffer
			this.copyNumPatterns=0;			// Number of patterns to copy
			this.copyBuffer=[];				// Array of data of the copy buffer

			this.newGDU=[ 0,60,66,66,126,66,66,0,0,124,66,124,66,66,124,0,0,60,66,64,64,66,60,0,0,120,68,66,66,68,120,0,0,126,64,124,64,64,126,0,0,126,64,124,64,64,64,0,0,60,66,64,78,66,60,0,0,66,66,126,66,66,66,0,0,62,8,8,8,8,62,0,0,2,2,2,66,66,60,0,0,68,72,112,72,68,66,0,0,64,64,64,64,64,126,0,0,66,102,90,66,66,66,0,0,66,98,82,74,70,66,0,0,60,66,66,66,66,60,0,0,124,66,66,124,64,64,0,0,60,66,66,82,74,60,0,0,124,66,66,124,68,66,0,0,60,64,60,2,66,60,0,0,254,16,16,16,16,16,0,0,66,66,66,66,66,60,0 ];
			this.newFont=[ 0,0,0,0,0,0,0,0,0,16,16,16,16,0,16,0,0,36,36,0,0,0,0,0,0,36,126,36,36,126,36,0,0,8,62,40,62,10,62,8,0,98,100,8,16,38,70,0,0,16,40,16,42,68,58,0,0,8,16,0,0,0,0,0,0,4,8,8,8,8,4,0,0,32,16,16,16,16,32,0,0,0,20,8,62,8,20,0,0,0,8,8,62,8,8,0,0,0,0,0,0,8,8,16,0,0,0,0,62,0,0,0,0,0,0,0,0,24,24,0,0,0,2,4,8,16,32,0,0,60,70,74,82,98,60,0,0,24,40,8,8,8,62,0,0,60,66,2,60,64,126,0,0,60,66,12,2,66,60,0,0,8,24,40,72,126,8,0,0,126,64,124,2,66,60,0,0,60,64,124,66,66,60,0,0,126,2,4,8,16,16,0,0,60,66,60,66,66,60,0,0,60,66,66,62,2,60,0,0,0,0,16,0,0,16,0,0,0,16,0,0,16,16,32,0,0,4,8,16,8,4,0,0,0,0,62,0,62,0,0,0,0,16,8,4,8,16,0,0,60,66,4,8,0,8,0,0,60,74,86,94,64,60,0,0,60,66,66,126,66,66,0,0,124,66,124,66,66,124,0,0,60,66,64,64,66,60,0,0,120,68,66,66,68,120,0,0,126,64,124,64,64,126,0,0,126,64,124,64,64,64,0,0,60,66,64,78,66,60,0,0,66,66,126,66,66,66,0,0,62,8,8,8,8,62,0,0,2,2,2,66,66,60,0,0,68,72,112,72,68,66,0,0,64,64,64,64,64,126,0,0,66,102,90,66,66,66,0,0,66,98,82,74,70,66,0,0,60,66,66,66,66,60,0,0,124,66,66,124,64,64,0,0,60,66,66,82,74,60,0,0,124,66,66,124,68,66,0,0,60,64,60,2,66,60,0,0,254,16,16,16,16,16,0,0,66,66,66,66,66,60,0,0,66,66,66,66,36,24,0,0,66,66,66,66,90,36,0,0,66,36,24,24,36,66,0,0,130,68,40,16,16,16,0,0,126,4,8,16,32,126,0,0,14,8,8,8,8,14,0,0,0,64,32,16,8,4,0,0,112,16,16,16,16,112,0,0,16,56,84,16,16,16,0,0,0,0,0,0,0,0,255,0,28,34,120,32,32,126,0,0,0,56,4,60,68,60,0,0,32,32,60,34,34,60,0,0,0,28,32,32,32,28,0,0,4,4,60,68,68,60,0,0,0,56,68,120,64,60,0,0,12,16,24,16,16,16,0,0,0,60,68,68,60,4,56,0,64,64,120,68,68,68,0,0,16,0,48,16,16,56,0,0,4,0,4,4,4,36,24,0,32,40,48,48,40,36,0,0,16,16,16,16,16,12,0,0,0,104,84,84,84,84,0,0,0,120,68,68,68,68,0,0,0,56,68,68,68,56,0,0,0,120,68,68,120,64,64,0,0,60,68,68,60,4,6,0,0,28,32,32,32,32,0,0,0,56,64,56,4,120,0,0,16,56,16,16,16,12,0,0,0,68,68,68,68,56,0,0,0,68,68,40,40,16,0,0,0,68,84,84,84,40,0,0,0,68,40,16,40,68,0,0,0,68,68,68,60,4,56,0,0,124,8,16,32,124,0,0,14,8,48,8,8,14,0,0,8,8,8,8,8,8,0,0,112,16,12,16,16,112,0,0,20,40,0,0,0,0,0,60,66,153,161,161,153,66,60 ];

			this._initElements();		
		}


		_initElements() {		
			console.debug("_initElements");

			setTimeout(this.Timer_Tick,500);
			setTimeout(this.DrawPreview,500);

			btnExportTAP.onclick=this.ExportToTAP;
			btnExportBOR.onclick=this.ExportToBOR;
			btnExportDIM.onclick=this.ExportToDIM;
			btnExportASM.onclick=this.ExportToASM;
			btnExportDATA.onclick=this.ExportToDATA;

			btnNewCancel.onclick=this.New_Cancel;
			btnNewOK.onclick=this.New_OK;
			btnErrorOK.onclick=this.Error_OK;

			btnClear.onclick=this.btnClear_Click;
			btnCut.onclick=this.btnCut_Click;
			btnCopy.onclick=this.btnCopy_Click;
			btnPaste.onclick=this.btnPaste_Click;

			btnHorizontalMirror.onclick=this.btnHorizontalMirror_Click;
			btnVerticalMirror.onclick=this.btnVerticalMirror_Click;
			btnRotateLeft.onclick=this.btnRotateLeft_Click;
			btnRotateRight.onclick=this.btnRotateRight_Click;

			btnShiftLeft.onclick=this.btnShiftLeft_Click;
			btnShiftRight.onclick=this.btnShiftRight_Click;
			btnShiftUp.onclick=this.btnShiftUp_Click;
			btnShiftDown.onclick=this.btnShiftDown_Click;
			
			btnMoveLeft.onclick=this.btnMoveLeft_Click;
			btnMoveRight.onclick=this.btnMoveRight_Click;
			btnMoveUp.onclick=this.btnMoveUp_Click;
			btnMoveDown.onclick=this.btnMoveDown_Click;
			
			btnInvert.onclick=this.btnInvert_Click;
			btnMask.onclick=this.btnMask_Click;

			//btnExport.onclick=this.btnExport_Click;
			//btnSettings.onclick=this.btnSettings_Click;
			
			window.addEventListener('contextmenu', e => {
				e.stopImmediatePropagation()
			}, true);
		}
		
		
		Timer_Tick(){
			if(sldZoom.value!=editor.lastZoom){
				editor.TB_Zoom_Changed();
			}
			if(txtWidth.value!=editor.lastWidth){
				editor.TB_Width_Changed();
			}
			if(txtHeight.value!=editor.lastHeight){
				editor.TB_Height_Changed();
			}
			setTimeout(editor.Timer_Tick,500);
		}


		CreateElements(){
			console.debug("CreateElements");				
			this.CreateToolBar();
			this.CreatePatterns();
			this.CreateEditor();
			this.CreatePreview();
			this.CreateBackPatterns();
		}


		CreateToolBar(){
			// Palette selection
			switch(this.patternMode){
				case 0:		// ZX Spectrum ULA (classic)
				case 1:
				case 2:
					this.palette=this.colorsULA;
					break;
			}

			btnInk.onclick=this.btnInk_Click;
			btnPaper.onclick=this.btnPaper_Click;
			divOpacity.onclick=this.CloseOpacity;
			btnExportCancel.onclick=this.ExportTo_Cancel;
			btnExportExport.onclick=this.ExportTo_Accept;
			this.SelectColor_Update();
		}

		
		/* - Color selector --------------------------------------------------- */
		btnInk_Click(e){
			editor.selector="INK";
			editor.SelectColor(e.clientX,e.clientY,editor.inkColor);
		}
		
		
		btnPaper_Click(e){
			editor.selector="PAPER";
			editor.SelectColor(e.clientX,e.clientY,editor.paperColor);
		}
		
		
		SelectColor(x,y,selColor){
			editor.modal="Color";
			editor.ShowOpacity();
			divSelectorColores.innerHTML="";
			divSelectorColores.style.top=y+"px";
			divSelectorColores.style.left=x+"px";
			divSelectorColores.style.width=16*8;
			// Only for ULA classic
			for(var n=0; n<editor.palette.length; n++){
				var div=document.createElement('div');
				div.className="itemColor";
				div.setAttribute("idColor",n);
				div.style.backgroundColor=editor.palette[n];
				if(n==selColor){
					div.style.border="2px dashed #ff00ff";
				}
				div.onclick=function(e){editor.Color_Selected(e)};
				divSelectorColores.append(div);
			}
			divSelectorColores.style.display="block";			
		}
		

		Color_Selected(e){
			let idColor=e.target.getAttribute("idColor");
			if(editor.selector=="INK"){
				editor.inkColor=idColor;
			}else if(editor.selector=="PAPER"){
				editor.paperColor=idColor;
			}
			divSelectorColores.style.display="none";	

			if(idColor>8){
				editor.bright=1;
				if(editor.inkColor<8){
					editor.inkColor+=8;
				}
				if(editor.paperColor<8){
					editor.paperColor+=8;
				}
			}else{
				editor.bright=0;
			}

			editor.SelectColor_Update();
			editor._redraw();
			editor.HideOpacity();
		}

		
		SelectColor_Update(){
			divInk.style.backgroundColor=this.palette[this.inkColor];
			divPaper.style.backgroundColor=this.palette[this.paperColor];
			if(this.bright==0){
				divBright.innerHTML="OFF";
			}else{
				divBright.innerHTML="ON";
			}
		}	
		
		
		_redraw() {	
			for(var n=0; n<this.patternsCount; n++)	{
				this.RedrawPattern(n);
			}
			this.RedrawEditor();
		}


		async Reset(data) {
			if (data) {
				this.selectedPattern=0;
				switch(data.length){
					case 168:	// 21x8=168 (GDUs)
						this.Load1bitData(data);
						this.patternMode=0;
						this.patternsCount=21;
						break;
					case 768:	// 96x8=768 (Fonts)
						this.Load1bitData(data);
						this.patternMode=1;
						this.patternsCount=96;
						break;
					default:
						editor.ModalNewShow(1);
						break;
				}
			}
			this.CreateElements();
			this._redraw();
		}


		Load1bitData(data){
			this.patterns=[];
			let idData=0;
			for(var n=0; n<data.length; n++){
				let pattern=new Pattern();				
				let id=0;
				for(var m=0; m<8; m++){
					let byte=parseInt(data[idData]);
					idData++;
					id+=7;
					for(var b=0; b<8; b++){
						let bit=byte & 1;
						pattern.Points[id]=bit;
						id--;
						byte=byte >> 1;
					}
					id+=9;
				}
				this.patterns.push(pattern);
			}
		}


		/* - Patterns ----------------------------------------------------------------------------- */
		CreatePatterns(){
			let patNumber=0;

			switch(this.patternMode){
				case 0:
					this.patternsCount=21;
					patNumber=65;
					break;
				case 1:
					this.patternsCount=96;
					patNumber=32;
					break;
			}

			// Remove existing controls */
			let divs=null;
			do{
				divs=document.querySelector(".patterns-div");
				if(divs!=null){
					divs.remove();
				}
			}
			while(divs!=null);

			// Create new controls
			for(var n=0; n<this.patternsCount; n++){
				this.CreatePattern(n,String.fromCharCode(patNumber))				
				patNumber++;
			}
		}


		CreateBackPatterns(){
			editor.backPatterns=[];
			for(let pat=0; pat<editor.patternsCount; pat++){
				let pattern=new Pattern();
				for(var poi=0; poi<64; poi++){
					pattern.Points[poi]=0;
				}
				editor.backPatterns.push(pattern);
			}
		}


		CreatePattern(id,label){
			let num=id;
			switch(this.patternMode){
				case 0:
					this.patternsCount=21;
					num++;
					break;
				case 1:
					this.patternsCount=96;
					num+=32;
					break;
			}

			let div=document.createElement('div');
			div.id="divPattern_"+id;
			div.className="patterns-div";
			div.onclick=this.Pattern_Click;
			let divLabel=document.createElement('div');
			divLabel.className="patterns-itemLabel";
			if(label==" "){
				label="&nbsp;";
			}
			divLabel.innerHTML="<span class='cyan'>"+label+"</span>&nbsp;&nbsp;"+num;
			div.append(divLabel);
			let divItem=document.createElement('div');
			divItem.className="patterns-item";
			let canvas=document.createElement('canvas');
			canvas.id="cnvPattern_"+id;
			canvas.width=32;
			canvas.height=32;
			divItem.append(canvas);
			div.append(divItem);
			divPatternsMain.append(div);	
			this.RedrawPattern(id);		
		}		


		RedrawPattern(id){
			let cnv=document.querySelector("#cnvPattern_"+id);
			let ctx=cnv.getContext('2d');
			let pattern=this.patterns[id];
			let idx=0;
			for(var y=0; y<8; y++){
				for(var x=0; x<8; x++){
					if(pattern==null || pattern.Points==null){
						continue;
					}
					let value=pattern.Points[idx];
					if(value==0){
						ctx.fillStyle=editor.palette[editor.paperColor];
					}
					else{
						ctx.fillStyle=editor.palette[editor.inkColor];
					}
					ctx.fillRect(x*4, y*4, 4, 4);
					idx++;
				}
			}
			if(this.selectedPattern==id){
				cnv?.parentElement?.classList.add("selected");
			}else{
				cnv?.parentElement?.classList.remove("selected");
			}
		}


		Pattern_Click(e){
			let id=e.target.id;
			id=id.replace("cnvPattern_","");
			editor.Pattern_Select(parseInt(id));
		}


		Pattern_Select(id){		
			document.querySelector("#cnvPattern_"+editor.selectedPattern)?.parentElement?.classList.remove("selected");
			editor.selectedPattern=id;
			document.querySelector("#cnvPattern_"+editor.selectedPattern)?.parentElement?.classList.add("selected");
			editor.RedrawEditor();
		}


		/* - Editor ----------------------------------------------------------------------------- */
		CreateEditor(){
			document.querySelector(".divEditor")?.remove();
			let div=document.createElement('div');
			div.className="divEditor";
			let canvas=document.createElement('canvas');
			canvas.id="cnvEditor";
			canvas.width=512;
			canvas.height=512;
			div.append(canvas);
			
			//div.onclick=this.Editor_Click;
			div.onmousedown=this.Editor_MouseDown;
			div.onmouseup=this.Editor_MouseUp;
			div.onmousemove=this.Editor_MouseMove;
			div.onwheel=this.Editor_MouseWhell;

			divEditor.append(div);	
			this.RedrawEditor();
		}


		RedrawEditor(){
			let cnv=document.querySelector("#cnvEditor");
			if(cnv==null){
				return;
			}
			let ctx=cnv.getContext('2d');

			cnv.width=editor.patternWidth*8*editor.zoom;
			cnv.height=editor.patternHeight*8*editor.zoom;
			ctx.clearRect(0,0,cnv.width,cnv?.height);

			let idPattern=editor.selectedPattern;
			let pattern=editor.patterns[idPattern];
			let pix=0;
			let piy=0;
			for(var py=0; py<editor.patternHeight; py++){
				pix=0;
				for(var px=0; px<editor.patternWidth; px++){
					let idx=0;

					ctx.strokeStyle="white";
					
					for(var y=0; y<8; y++){
						for(var x=0; x<8; x++){
							if(pattern==null || pattern.Points==null){
								continue;
							}
							let value=pattern.Points[idx];
							if(value==0){
								ctx.fillStyle=editor.palette[editor.paperColor];
							}
							else{
								ctx.fillStyle=editor.palette[editor.inkColor];
							}
							let xx=pix+(x*editor.zoom);
							let yy=piy+(y*editor.zoom);
							ctx.fillRect(xx, yy, editor.zoom, editor.zoom);
							ctx.strokeRect(xx, yy, editor.zoom, editor.zoom);
							idx++;
						}
					}
					ctx.strokeStyle="red";
					ctx.strokeRect(pix, piy, editor.zoom*8, editor.zoom*8);

					idPattern++;
					pattern=editor.patterns[idPattern];
					pix=pix+(editor.zoom*8);
				}
				piy=piy+(editor.zoom*8);
			}
		}

		
		Editor_MouseDown(e){
			editor.GetMouseCoords(e);
			editor.mouseButton=e.button+1;
			editor.mouseDown=1;

			editor.mouseLastX=editor.mouseX;
			editor.mouseLastY=editor.mouseY;
			editor.mouseLastIdPattern=editor.mouseIdPattern;

			let oldValue=editor.Editor_GetPointValue(editor.mouseIdPattern,editor.mouseX,editor.mouseY);	
			switch(editor.mouseButton){
				case 1:
					editor.mouseColor=1;
					break;
				case 3:
					editor.mouseColor=0;
					break;
				default:
					return;
			}
			if(oldValue==editor.mouseColor){
				return;
			}
			
			editor.Editor_SetPointValue(editor.mouseIdPattern,editor.mouseX,editor.mouseY,editor.mouseColor);

			let click={
				type: 'editor_click',
				color: editor.mouseColor,
				old: oldValue,
				x: editor.mouseX,
				y: editor.mouseY,
				pattern: editor.mouseIdPattern
			};			
			editor.editorClicks.push(click);
			vscode.postMessage(click);
		}


		Editor_MouseUp(e){
			editor.mouseButton=0;
			editor.mouseDown=0;
			editor.mouseLastX=-1;
			editor.mouseLastY=-1;
			editor.mouseLastIdPattern=-1;
		}


		Editor_MouseMove(e){
			if(editor.mouseDown==0){
				return;
			}

			editor.GetMouseCoords(e);
			if(editor.mouseX==editor.mouseLastX && editor.mouseY==editor.mouseLastY && editor.mouseIdPattern==editor.mouseLastIdPattern){
				return;
			}

			editor.mouseLastX=editor.mouseX;
			editor.mouseLastY=editor.mouseY;
			editor.mouseLastIdPattern=editor.mouseIdPattern;

			let oldValue=editor.Editor_GetPointValue(editor.mouseIdPattern,editor.mouseX,editor.mouseY);	
			switch(editor.mouseButton){
				case 1:
					editor.mouseColor=1;
					break;
				case 3:
					editor.mouseColor=0;
					break;
				default:
					return;
			}
			if(oldValue==editor.mouseColor){
				return;
			}
			
			editor.Editor_SetPointValue(editor.mouseIdPattern,editor.mouseX,editor.mouseY,editor.mouseColor);

			let click={
				type: 'editor_click',
				color: editor.mouseColor,
				old: oldValue,
				x: editor.mouseX,
				y: editor.mouseY,
				pattern: editor.mouseIdPattern
			};			
			editor.editorClicks.push(click);
			vscode.postMessage(click);
		}


		Editor_MouseWhell(e){	
			let value=sldZoom.value;
			if(e.wheelDelta<0 && value<8){
				sldZoom.value++;
			} else if(e.wheelDelta>0 && value>0){
				sldZoom.value--;
			}			
			editor.Zooom_Update();
		}


		GetMouseCoords(e){
			let ctrl=e.target;
			let x=parseInt((e.x-ctrl.offsetLeft+divEditorMain.scrollLeft)/editor.zoom);
			let y=parseInt((e.y-ctrl.offsetTop+divEditorMain.scrollTop)/editor.zoom);
			// Check bounds
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;
			if(x>maxX || x<0){
				return;
			}
			if(y>maxY || y<0){
				return;
			}

			let idPattern=editor.selectedPattern;
			while(x>7){
				x-=8;
				idPattern++;
			}
			while(y>7){
				y-=8;
				idPattern=idPattern+parseInt(editor.patternWidth);
			}
			editor.mouseX=x;
			editor.mouseY=y
			editor.mouseIdPattern=idPattern;
		}


		Editor_SetPointValue(idPattern,x,y,color){
			let idx=(y*8)+x;			
			let pattern=editor.patterns[idPattern];			
			pattern.Points[idx]=color;
			editor.RedrawEditor();
			editor.RedrawPattern(idPattern);
		}


		Editor_GetPointValue(idPattern,x,y){
			let idx=(y*8)+x;
			let value=editor.patterns[idPattern].Points[idx];
			return value;
		}


		Editor_UnDo_ReDo(data){
			if(data.length>editor.editorClicks.length){
				// Redo				
				let last=data.pop();
				editor.Editor_SetPointValue(last.pattern,last.x,last.y,last.color);
				editor.editorClicks.push(last);
			} else{
				// Undo
				let last=editor.editorClicks.pop();
				editor.Editor_SetPointValue(last.pattern,last.x,last.y,last.old);
			}
		}


		/* - ToolBar ----------------------------------------------------------------- */
		TB_Zoom_Changed(e){
			editor.Zooom_Update();
		}


		Zooom_Update(){
			let value=sldZoom.value;
			editor.lastZoom=value;
			editor.zoom=this.scales[value]; // Math.pow(2,value);
			txtZoom.innerHTML=editor.zoom+"x";
			editor.RedrawEditor();
			editor.RedrawEditor();
		}


		TB_Width_Changed(e){
			let value=txtWidth.value;
			editor.lastWidth=value;
			editor.patternWidth=value;
			editor.RedrawEditor();
		}


		TB_Height_Changed(e){
			let value=txtHeight.value;
			editor.lastHeight=value;
			editor.patternHeight=value;
			editor.RedrawEditor();
		}


		/* - Preview ----------------------------------------------------------------- */
		CreatePreview(){
			let canvas=document.createElement('canvas');
			canvas.id="cnvPreview";
			canvas.width=32;
			canvas.height=32;
			divPatternPreview.append(canvas);
		}


		DrawPreview(){
			editor.frameStart=txtFirstPattern.value;
			editor.framesLength=txtNumPatterns.value;

			let cnv=document.querySelector("#cnvPreview");
			let w=txtWidthPatterns.value;
			let h=txtHeightPatterns.value;
			cnv.width=w*16;
			cnv.height=h*16;
			let ctx=cnv.getContext('2d');

			let idPattern=editor.framesActual;
			for(var py=0; py<h; py++){
				let yy=py*16;
				for(var px=0; px<w; px++){					
					let xx=px*16;
					let pattern=editor.patterns[idPattern];
					let idx=0;
					for(var y=0; y<8; y++){
						for(var x=0; x<8; x++){
							if(pattern==null || pattern.Points==null){
								continue;
							}
							let value=pattern.Points[idx];
							if(value==0){
								ctx.fillStyle=editor.palette[editor.paperColor];
							}
							else{
								ctx.fillStyle=editor.palette[editor.inkColor];
							}
							ctx.fillRect(xx+(x*2),yy+(y*2),2,2);
							idx++;
						}
					}
					idPattern++;
				}
			}
			editor.framesActual=idPattern;
			let max=parseInt(editor.framesLength)*(w*h);
			if(editor.framesActual>=max){
				editor.framesActual=editor.frameStart;
			}
			setTimeout(editor.DrawPreview,cmbSpeed.value);
		}


		/* - Exports ----------------------------------------------------------------- */
		ExportToTAP(){
			editor.modal="TAP";
			txtExportFileName.value="Test.tap";
			editor.ShowClass("export-TAP");
			editor.HideClass("export-DATA");
			editor.HideClass("export-BOR");
			editor.HideClass("export-DIM");
			modalExport.style.display="flex";
		}


		ExportToBOR(){
			editor.modal="BOR";
			txtExportFileName.value="Test.bas";
			editor.HideClass("export-TAP");
			editor.HideClass("export-DATA");
			editor.ShowClass("export-BOR");
			editor.HideClass("export-DIM");
			modalExport.style.display="flex";
		}


		ExportToDIM(){
			editor.modal="DIM";
			txtExportFileName.value="Test.bas";
			editor.HideClass("export-TAP");
			editor.HideClass("export-DATA");
			editor.HideClass("export-BOR");
			editor.ShowClass("export-DIM");
			modalExport.style.display="flex";
		}


		ExportToASM(){
			editor.modal="ASM";
			txtExportFileName.value="Test.asm";
			editor.HideClass("export-TAP");
			editor.HideClass("export-DATA");
			editor.ShowClass("export-BOR");
			editor.HideClass("export-DIM");
			modalExport.style.display="flex";
		}


		ExportToDATA(){
			editor.modal="DATA";
			txtExportFileName.value="Test.bas";
			editor.HideClass("export-TAP");
			editor.ShowClass("export-DATA");
			editor.HideClass("export-BOR");
			editor.HideClass("export-DIM");
			modalExport.style.display="flex";
		}


		ExportTo_Cancel(){
			modalExport.style.display="none";
		}


		ExportTo_Accept(){
			modalExport.style.display="none";
			switch(editor.modal){
				case "TAP":
					editor.ExportToTAP_Accept();
					break;
				case "BOR":
					editor.ExportToBOR_Accept();
					break;
				case "DIM":
					editor.ExportToDIM_Accept();
					break;
				case "ASM":
					editor.ExportToASM_Accept();
					break;
				case "DATA":
					editor.ExportToDATA_Accept();
					break;					
			}
		}


		ExportToTAP_Accept(){
			editor.GetFileData().then(data => {
				let tapArray=generateTAP(data,parseInt(txtExportZXAddress.value),txtExportZXFileName.value);
				vscode.postMessage({ type: 'exportTAP', typeData: "binary", body: Array.from(tapArray), fileName: txtExportFileName.value });
			});
		}


		ExportToBOR_Accept(){
			editor.GetFileData().then(data => {
				let dataCode=editor.ExportToBOR_DO(data,txtExportLabelName.value);
				vscode.postMessage({ type: 'exportBOR', typeData: "binary", body: dataCode, fileName: txtExportFileName.value });
			});
		}


		ExportToDIM_Accept(){
			editor.GetFileData().then(data => {
				let dataCode=editor.ExportToDIM_DO(data,txtExportVariableName.value);
				vscode.postMessage({ type: 'exportDIM', typeData: "binary", body: dataCode, fileName: txtExportFileName.value });
			});
		}


		ExportToBOR_DO(data,labelName){
			debugger;
			let txt="";
			switch(data.length){
				case 168:
					txt="' Sample code\r\n' -----------\r\n' POKE (UINTEGER 23675,@"+labelName+")\r\n\r\n";
					break;
				case 768:
					txt="' Sample code\r\n' -----------\r\n' POKE (UINTEGER 23606,@"+labelName+"-256)\r\n\r\n";
					break;
			}
			txt=txt+labelName+":\r\nASM\r\n";
			let counter=0;
			let line=""
			for(var n=0; n<data.length; n++){
				if(line==""){
					line="\tDB ";
				}else{
					line=line+",";
				}
				line=line+data[n].toString();
				counter++;
				if(counter==8){
					txt=txt+line+"\r\n";
					line="";
					counter=0;
				}
			}
			if(line!=""){
				line=line+"\r\n";
			}
			txt=txt+"END ASM\r\n";
			return txt;
		}


		ExportToDIM_DO(data,varName){
			let lines=data.length/8;			
			let txt="";
			switch(data.length){
				case 168:
					txt="' Sample code\r\n' -----------\r\n' POKE (uInteger 23675,@"+varName+")\r\n\r\n";
					break;
				case 768:
					txt="' Sample code\r\n' -----------\r\n' POKE (uInteger 23606,@"+varName+"-256)\r\n\r\n";
					break;
			}
			txt=txt+"DIM "+varName+"("+(lines-1)+",7) AS uByte => { _\r\n";

			let counter=0;
			let line=""
			for(var n=0; n<data.length; n++){
				if(line==""){
					line="\t{ ";
				}else{
					line=line+",";
				}
				line=line+data[n].toString();
				counter++;
				if(counter==8){
					if(n==data.length-1){
						txt=txt+line+"} _\r\n";	
					}else{
						txt=txt+line+"}, _\r\n";
					}
					line="";
					counter=0;
				}
			}
			if(line!=""){
				line=line+"} _\r\n";
			}
			txt=txt+"}\r\n";
			return txt;
		}


		ExportToASM_Accept(){
			editor.GetFileData().then(data => {
				let dataCode=editor.ExportToASM_DO(data,txtExportLabelName.value);
				vscode.postMessage({ type: 'exportASM', typeData: "binary", body: dataCode, fileName: txtExportFileName.value });
			});
		}


		ExportToASM_DO(data,labelName){
			let txt=labelName+":\r\n";
			let counter=0;
			let line=""
			for(var n=0; n<data.length; n++){
				if(line==""){
					line="\tDB ";
				}else{
					line=line+",";
				}
				line=line+data[n].toString();
				counter++;
				if(counter==8){
					txt=txt+line+"\r\n";
					line="";
					counter=0;
				}
			}
			if(line!=""){
				line=line+"\r\n";
			}
			txt=txt+"\r\n";
			return txt;
		}


		ExportToDATA_Accept(){
			editor.GetFileData().then(data => {
				let dataCode=editor.ExportToDATA_DO(data,txtExportLineNumber.value);
				vscode.postMessage({ type: 'exportDATA', typeData: "binary", body: dataCode, fileName: txtExportFileName.value });
			});
		}


		ExportToDATA_DO(data,lineNumber){
			let line="";
			for(var n=0; n<data.length; n++){
				if(line==""){
					line=lineNumber+" DATA "
				}else{
					line=line+",";
				}
				line=line+data[n].toString();
			}
			line=line+"\r\n";
			return line;
		}


		/* - File operations --------------------------------------------------------- */
		/** @return {Promise<Uint8Array>} */
		async GetFileData() {
			let l=0;
			let pats=0;
			switch(editor.patternMode){
				case 0:		// GDUs 21x8 (168 bytes)
					l=168;
					pats=21;
					break;
				case 1:		// Fonts 96x8 (768 bytes)
					l=768;
					pats=96;
					break;
			}
			let data=new Uint8Array(l);
			let idx=0;

			// Only for classic graphics
			for(var n=0; n<pats; n++){
				let pt=editor.patterns[n];
				for(var m=0; m<8; m++){
					let value=0;
					let bv=128;
					for(var b=0; b<8; b++){
						let i=(m*8)+b;
						let bit=pt.Points[i];
						if(bit==1){
							value=value+bv;
						}
						bv=bv/2;
					}
					data[idx]=value;
					idx++;
				}
			}

			return data;
		}


		/* - ToolBar icons --------------------------------------------------------------------- */
		btnClear_Click(){
			let idPattern=editor.selectedPattern;
			let max=(editor.patternWidth*editor.patternHeight)+idPattern;
			for(var n=idPattern; n<max; n++){
				let pattern=editor.patterns[n];
				let id=0;
				for(var y=0; y<8; y++){
					for(var x=0; x<8; x++){
						if(pattern.Points[id]!=0){
							let click={
								type: 'editor_click',
								color: 0,
								old: 1,
								x: x,
								y: y,
								pattern: n
							};			
							editor.editorClicks.push(click);
							vscode.postMessage(click);
						}
						pattern.Points[id]=0;
						id++;
					}
				}
			}
			editor._redraw();
		}


		btnCut_Click(){
			let idPattern=editor.selectedPattern;
			let max=(editor.patternWidth*editor.patternHeight)+idPattern;
			editor.copyIdPattern=idPattern;
			editor.copyNumPatterns=editor.patternWidth*editor.patternHeight;
			editor.copyBuffer=[];
			for(var n=idPattern; n<max; n++){
				let pattern=editor.patterns[n];
				let id=0;
				for(var y=0; y<8; y++){
					for(var x=0; x<8; x++){
						let value=pattern.Points[id];
						if(value!=0){
							let click={
								type: 'editor_click',
								color: 0,
								old: 1,
								x: x,
								y: y,
								pattern: n
							};
							editor.editorClicks.push(click);
							vscode.postMessage(click);
						}
						editor.copyBuffer.push(value);
						pattern.Points[id]=0;
						id++;
					}
				}
			}
			editor._redraw();
		}


		btnCopy_Click(){
			let idPattern=editor.selectedPattern;
			let max=(editor.patternWidth*editor.patternHeight)+idPattern;
			editor.copyIdPattern=idPattern;
			editor.copyNumPatterns=editor.patternWidth*editor.patternHeight;
			editor.copyBuffer=[];
			for(var n=idPattern; n<max; n++){
				let pattern=editor.patterns[n];
				let id=0;
				for(var y=0; y<8; y++){
					for(var x=0; x<8; x++){
						let value=pattern.Points[id];						
						editor.copyBuffer.push(value);
						id++;
					}
				}
			}
		}


		btnPaste_Click(){
			let idPattern=editor.selectedPattern;
			let max=editor.copyNumPatterns+idPattern;
			let cbId=0;
			for(var n=idPattern; n<max; n++){
				let pattern=editor.patterns[n];
				let id=0;
				for(var y=0; y<8; y++){
					for(var x=0; x<8; x++){
						let value=editor.copyBuffer[cbId];
						let oldValue=pattern.Points[id];
						pattern.Points[id]=value;
						let click={
							type: 'editor_click',
							color: value,
							old: oldValue,
							x: x,
							y: y,
							pattern: n
						};
						editor.editorClicks.push(click);
						vscode.postMessage(click);
						id++;
						cbId++;
					}
				}
			}
			editor._redraw();
		}


		btnHorizontalMirror_Click(){
			let maxX=editor.patternWidth*8;
			let medX=maxX/2;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<medX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// Read point 2
					let x2=maxX-1-x;
					let y2=y;
					let p2=FullPoint.GetData(x2,y2);
					
					// Set point 1
					let p1r=FullPoint.SetData(x,y,p2.value);
					let c1={
						type: 'editor_click',
						color: p2.value,
						old: p1r.value,
						x: p1r.x,
						y: p1r.y,
						pattern: p1r.idPattern
					};
					editor.editorClicks.push(c1);
					vscode.postMessage(c1);
					// Set point 2
					let p2r=FullPoint.SetData(x2,y2,p1.value);
					let c2={
						type: 'editor_click',
						color: p1.value,
						old: p2r.value,
						x: p2r.x,
						y: p2r.y,
						pattern: p2r.idPattern
					};
					editor.editorClicks.push(c2);
					vscode.postMessage(c2);
				}
			}

			editor.RedrawEditor();
			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				editor.RedrawPattern(id);
			}
		}


		btnVerticalMirror_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;
			let medY=maxY/2;

			for(let x=0; x<maxX; x++){
				for(let y=0; y<medY; y++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// Read point 2
					let x2=x;
					let y2=maxY-1-y;
					let p2=FullPoint.GetData(x2,y2);
					
					// Set point 1
					let p1r=FullPoint.SetData(x,y,p2.value);
					let c1={
						type: 'editor_click',
						color: p2.value,
						old: p1r.value,
						x: p1r.x,
						y: p1r.y,
						pattern: p1r.idPattern
					};
					editor.editorClicks.push(c1);
					vscode.postMessage(c1);
					// Set point 2
					let p2r=FullPoint.SetData(x2,y2,p1.value);
					let c2={
						type: 'editor_click',
						color: p1.value,
						old: p2r.value,
						x: p2r.x,
						y: p2r.y,
						pattern: p2r.idPattern
					};
					editor.editorClicks.push(c2);
					vscode.postMessage(c2);
				}
			}

			editor.RedrawEditor();
			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				editor.RedrawPattern(id);
			}
		}


		btnRotateLeft_Click(){	
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			if(maxX!=maxY){
				editor.ShowError("Rotation is only allowed in groups of patterns of the same width and height.");
				return;
			}

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=y;
					let y2=maxX-1-x;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnRotateRight_Click(){	
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			if(maxX!=maxY){
				editor.ShowError("Rotation is only allowed in groups of patterns of the same width and height.");
				return;
			}

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=maxY-1-y;
					let y2=x;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnShiftLeft_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x-1;
					if(x2<0){
						x2=maxX-1;
					}
					let y2=y;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnShiftRight_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x+1;
					if(x2>=maxX){
						x2=0;
					}
					let y2=y;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnShiftUp_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x;
					let y2=y-1;
					if(y2<0){
						y2=maxY-1;
					}
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnShiftDown_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x;
					let y2=y+1;
					if(y2>=maxY){
						y2=0;
					}
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnMoveLeft_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x-1;
					if(x2<0){
						x2=maxX-1;
						p1.value=0;
					}
					let y2=y;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnMoveRight_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x+1;
					if(x2>=maxX){
						x2=0;
						p1.value=0;
					}
					let y2=y;
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnMoveUp_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x;
					let y2=y-1;
					if(y2<0){
						y2=maxY-1;
						p1.value=0;
					}
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnMoveDown_Click(){
			let maxX=editor.patternWidth*8;
			let maxY=editor.patternHeight*8;

			for(let y=0; y<maxY; y++){
				for(let x=0; x<maxX; x++){
					// Read point 1
					let p1=FullPoint.GetData(x,y);
					// calc point 2
					let x2=x;
					let y2=y+1;
					if(y2>=maxY){
						y2=0;
						p1.value=0;
					}
					
					// Set point 2
					let p2=FullPoint.SetTempData(x2,y2,p1.value);
					let c={
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}

			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		btnInvert_Click(){
			let maxX = editor.patternWidth * 8;
			let maxY = editor.patternHeight * 8;

			for(let y = 0; y < maxY; y++){
				for(let x = 0; x < maxX; x++){
					let p1 = FullPoint.GetData(x, y);
					let p2 = FullPoint.SetTempData(x, y, p1.value ^ 1);
					let c = {
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}
			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();
		}


		/* - Create Mask ------------------ */
		btnMask_Click(){
			let maxX = editor.patternWidth * 8;
			let maxY = editor.patternHeight * 8;

			// Get x bounds			
			let boundX=new Array(maxY);
			for(let y = 0; y < maxY; y++){
				let min=maxX;
				let max=0;
				for(let x = 0; x < maxX; x++){
					if(FullPoint.GetData(x, y).value==1){
						min=x;
						break;
					}
				}
				for(let x = maxX-1; x >=0; x--){
					if(FullPoint.GetData(x, y).value==1){
						max=x;
						break;
					}
				}
				boundX[y]={
					min: min,
					max: max
				};
			}
			// Get y bounds			
			let boundY=new Array(maxX);
			for(let x = 0; x < maxX; x++){
				let min=maxY;
				let max=0;
				for(let y = 0; y < maxY; y++){
					if(FullPoint.GetData(x, y).value==1){
						min=y;
						break;
					}
				}
				for(let y = maxY-1; y >=0; y--){
					if(FullPoint.GetData(x, y).value==1){
						max=y;
						break;
					}
				}
				boundY[x]={
					min: min,
					max: max
				};
			}

			// Generate Mask
			let points=Array.from(Array(maxX), () => new Array(maxY));
			for(let y = 0; y < maxY; y++){
				for(let x = 0; x < maxX; x++){
					points[x][y]=0;
				}
			}
			// Mask x
			for(let y = 0; y < maxY; y++){
				let min=maxX;
				let max=0;
				let bound=boundX[y];
				for(let x = 0; x < maxX; x++){
					if(x<bound.min){
						points[x][y]=1;
					}
					if(x>bound.max){
						points[x][y]=1;
					}
				}
			}
			// Mask y
			for(let x = 0; x < maxX; x++){
				let min=maxY;
				let max=0;
				let bound=boundY[x];
				for(let y = 0; y < maxY; y++){
					if(y<bound.min){
						points[x][y]=1;
					}
					if(y>bound.max){
						points[x][y]=1;
					}
				}
			}

			// Draw mask
			for(let y = 0; y < maxY; y++){
				let txt="";
				for(let x = 0; x < maxX; x++){
					txt=txt+points[x][y]+",";
					let p1 = FullPoint.GetData(x, y);
					let p2 = FullPoint.SetTempData(x, y, points[x][y]);
					let c = {
						type: 'editor_click',
						color: p2.value,
						old: p1.value,
						x: p2.x,
						y: p2.y,
						pattern: p2.idPattern
					};
					editor.editorClicks.push(c);
					vscode.postMessage(c);
				}
			}
			let maxP=editor.selectedPattern+(editor.patternWidth*editor.patternHeight);
			for(let id=editor.selectedPattern; id<maxP; id++){
				for(let idx=0; idx<64; idx++){
					editor.patterns[id].Points[idx]=editor.backPatterns[id].Points[idx];
				}
				editor.RedrawPattern(id);
			}
			editor.RedrawEditor();			
		}


		/* - New ------------------------------------------------------------------------------- */
		ModalNewShow(show){
			modalNew.style.display="flex";
		}


		New_Cancel(){
			modalNew.style.display="none";
		}


		New_OK(){
			modalNew.style.display="none";

			if(radGDU.checked){
				editor.Reset(editor.newGDU);
			}else if(radFont.checked){
				editor.Reset(editor.newFont);
			}
		}


		/* - Tools ----------------------------------------------------------------------------- */
		ShowOpacity(){
			divOpacity.style.display="block";
		}


		HideOpacity(){
			divOpacity.style.display="none";
		}


		CloseOpacity(){
			editor.HideOpacity();
			switch(editor.modal){
				case "Color":
					divSelectorColores.style.display="none";
					break;
			}
		}


		ShowClass(className){
			var controls=document.getElementsByClassName(className);
			for(var n=0; n<controls.length; n++){
				controls[n].style.display="block";
			}
		}


		HideClass(className){
			var controls=document.getElementsByClassName(className);
			for(var n=0; n<controls.length; n++){
				controls[n].style.display="none";
			}
		}


		ShowError(txt){
			divLblError.innerHTML=txt;
			modalError.style.display="flex";
		}


		Error_OK(){			
			modalError.style.display="none";
		}
	}


	const editor = new GDU_Editor();

	window.addEventListener('message', async e => {
		const { type, body, requestId } = e.data;
		console.debug("Message: "+type);
		switch (type) {
			case 'init':
				{
					await editor.Reset(body.value);
					return;
				}
			case 'update':
				{
					editor.Editor_UnDo_ReDo(body.edits);
					//const strokes = body.edits.map(edit => new Stroke(edit.color, edit.stroke));
					//await editor.reset(body.content, strokes)
					return;
				}
			case 'getFileData':
				{
					editor.GetFileData().then(data => {
						vscode.postMessage({ type: 'response', requestId, body: Array.from(data) });
					});
					return;
				}
			default:
				{
					return;
				}
		}		
	});

	// Signal to VS Code that the webview is initialized.
	vscode.postMessage({ type: 'ready' });
}());
	