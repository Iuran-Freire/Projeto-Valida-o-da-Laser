# Conversion dependencies (local only):
# python -m pip install --target .tools/onnx-quantize onnx==1.23.2 onnxruntime==1.31.0
import sys
import hashlib,json
from pathlib import Path
sys.path.insert(0, str(Path('.tools/onnx-quantize').resolve()))
import onnx
import numpy as np
from onnx import numpy_helper,helper
import onnxruntime
from onnxruntime.quantization import quant_pre_process

original=Path('frontend/dist/vendor/paddle/serial-rec-en-v5.onnx')
converted=Path('.tools/ocr-research/serial-rec-v13.onnx')
optimized=Path('.tools/ocr-research/serial-rec-optimized.onnx')
target=Path('frontend/dist/vendor/paddle/serial-rec-en-v5-int8.onnx')
converted.parent.mkdir(parents=True,exist_ok=True)
model=onnx.version_converter.convert_version(onnx.load(original),13)
model.ir_version=8
onnx.save(model,converted)
quant_pre_process(str(converted),str(optimized),skip_symbolic_shape=True,skip_onnx_shape=True)
model=onnx.load(optimized)
weights={node.input[1]:0 if node.op_type=='Conv' else -1 for node in model.graph.node if node.op_type in ['Conv','MatMul']}
initializers=[]
dequantizers=[]
for tensor in model.graph.initializer:
    if tensor.name not in weights or tensor.data_type!=onnx.TensorProto.FLOAT or len(tensor.dims)<2:
        initializers.append(tensor)
        continue
    array=numpy_helper.to_array(tensor)
    axis=weights[tensor.name] % array.ndim
    reduced=tuple(i for i in range(array.ndim) if i!=axis)
    scale=np.maximum(np.max(np.abs(array),axis=reduced)/127,np.finfo(np.float32).tiny).astype(np.float32)
    shape=[1]*array.ndim
    shape[axis]=array.shape[axis]
    quantized=np.clip(np.round(array/scale.reshape(shape)),-127,127).astype(np.int8)
    initializers.extend([numpy_helper.from_array(quantized,tensor.name+'_int8'),numpy_helper.from_array(scale,tensor.name+'_scale'),numpy_helper.from_array(np.zeros_like(scale,dtype=np.int8),tensor.name+'_zero')])
    dequantizers.append(helper.make_node('DequantizeLinear',[tensor.name+'_int8',tensor.name+'_scale',tensor.name+'_zero'],[tensor.name],axis=axis))
nodes=list(model.graph.node)
model.graph.ClearField('initializer')
model.graph.initializer.extend(initializers)
model.graph.ClearField('node')
model.graph.node.extend(dequantizers+nodes)
onnx.save(model,target)
onnx.checker.check_model(str(target))
provenance={'source':'en_PP-OCRv5_mobile_rec','source_sha256':hashlib.sha256(original.read_bytes()).hexdigest(),
    'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,
    'weights':'per-channel symmetric INT8, Conv and MatMul','activations':'FLOAT32',
    'tools':{'onnx':onnx.__version__,'onnxruntime':onnxruntime.__version__},'reproduce':'python scripts/quantize-serial-reader.py'}
target.with_suffix('.provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8')
print({str(p):p.stat().st_size for p in [original,optimized,target]})
