import json

SRC = r"E:\Phong_Nho_IT\bot-discord\tien-nghich-nguon\cau-hoi\gd06-verify-383-401.json"
DST = r"E:\Phong_Nho_IT\bot-discord\tien-nghich-nguon\cau-hoi\gd06-verified-383-401.json"

data = json.load(open(SRC, encoding="utf-8"))

DROPS = {
    37: "Trùng lặp: ch.370 (file 364-382) đã hỏi Tôn Thái in phong ấn lên trán Vương Lâm.",
    56: "Trùng lặp: ý cảnh trà của Lý Nguyên Phong đã được hỏi ở ch.369/380 (file 364-382).",
    66: "Tên nhân vật phụ chỉ xuất hiện thoáng qua, quá vụn vặt.",
    69: "Trùng lặp: ch.369 (file 364-382) đã hỏi lão tổ Cự Ma nhắm tới Nghịch Thiên châu.",
    70: "Trùng ngân hàng: ch.315 đã hỏi Cự Ma tộc lấy Khai Thiên phủ từ mi tâm.",
    72: "Trùng với câu ch.390 trong file (các tổ tiên Anh Biến tự hiến hồn vào phiên).",
    75: "Tên trưởng lão chỉ xuất hiện một lần, quá vụn vặt.",
    80: "Trùng lặp: ch.344 (file 326-344) đã hỏi Hứa Lập Quốc bị ném vào tiên kiếm làm kiếm hồn.",
    90: "Đáp án bị lộ qua câu ch.390 (đuổi Liễu Mi) và câu ch.401 về lý do Độn Thiên đuổi nàng.",
}

FIXES = {
    1: ("Bỏ chữ 'Đại trưởng lão' khỏi đề để không lộ đáp án câu ch.387.",
        {"question": "Theo vị trưởng lão tiếp nhận Vương Lâm trong đại điện Luyện Hồn Phong, đệ tử trong tông học đạo theo cách nào?"}),
    3: ("Bỏ chữ 'Đại trưởng lão' khỏi đề để không lộ đáp án câu ch.387.",
        {"question": "Bị lão nhân trong đại điện Luyện Hồn Phong hỏi cách phá Tử chú thuật, Vương Lâm giải thích thế nào?"}),
    12: ("Đổi nội dung: 'lá cờ vàng' bị lộ bởi nhiều đề khác nhắc Kim sắc Hồn Phiên.",
         {"question": "Khi màn sương đen sâu trong linh mạch Luyện Hồn Phong ngưng tụ lại, thứ gì hiện ra lao vào Vương Lâm?",
          "options": ["Yêu thú hai sừng phủ sương đen", "Một bộ xương khô khổng lồ", "Một con rắn đen chín đầu", "Đám oan hồn hình người"],
          "correctIndex": 0,
          "explanation": "Sương đen ngưng tụ thành một yêu thú hai sừng, toàn thân tỏa sương và tơ đen, nhảy lên đánh Vương Lâm."}),
    22: ("Bỏ tên chuông khỏi giải thích vì truyện gọi không thống nhất.",
         {"explanation": "Lão lấy ra một chiếc chuông lớn làm bằng gỗ có vân tự nhiên, là trọng bảo mượn của Tỏa Thần phong."}),
    39: ("Phương án là cảnh giới cao hơn Vấn Đỉnh gây mơ hồ; đổi sang hỏi tu vi của Độn Thiên.",
         {"question": "Độn Thiên nói nhờ chí bảo của tông, dù lão chỉ ở cảnh giới nào vẫn dám đánh một trận với tu sĩ Vấn Đỉnh?",
          "options": ["Anh Biến sơ kỳ", "Anh Biến trung kỳ", "Anh Biến hậu kỳ", "Anh Biến đại viên mãn"],
          "correctIndex": 2,
          "explanation": "Lão nói nhờ Thập ức hồn phiên mà tuy chỉ là Anh Biến hậu kỳ vẫn dám đánh với tu sĩ Vấn Đỉnh."}),
    43: ("Đề cũ lộ đáp án câu ch.383 (Tằng Ngưu giết Hóa Thần); viết lại đề.",
         {"question": "Độn Thiên thừa nhận chính lão đã tung ra một tin đồn về Vương Lâm. Lão làm vậy nhằm mục đích gì?",
          "explanation": "Tin đồn Tằng Ngưu giết Hóa Thần của tông giúp lão có lý do đi tìm Vương Lâm mà người khác không để ý."}),
    50: ("Việc lấy Mộc linh đã hỏi ở ch.366 (file 364-382); đổi sang hỏi linh còn thiếu.",
         {"question": "Sau khi Nghịch Thiên châu hút tinh thể Mộc linh, Vương Lâm nhận ra hạt châu chỉ còn thiếu linh nào?",
          "options": ["Kim linh", "Thủy linh", "Hỏa linh", "Thổ linh"],
          "correctIndex": 0,
          "explanation": "Mộc linh bị hút vào, lá cây trên hạt châu đạt viên mãn; Vương Lâm lẩm bẩm chỉ còn thiếu Kim linh."}),
    54: ("Sửa chủ đề: câu hỏi về diễn biến, không phải cảnh giới.",
         {"topic": "cot_truyen"}),
    58: ("Thay phương án 'Kim linh còn thiếu' vì trùng đáp án câu ch.393.",
         {"options": ["Thi thể Lý Mộ Uyển", "Tiên ngọc của Hồng Điệp", "Bí thuật Anh Biến của hắn", "Cánh tay của Tư Đồ Nam"]}),
    63: ("Thêm chi tiết bị ném vào vết nứt không gian vì Hồng Điệp cũng từng đấu Tằng Ngưu.",
         {"question": "Trong bốn người lão đầu lôi thôi tuyển chọn, ai bị lão than là rắc rối nhất vì chọc Tằng Ngưu đến mức bị ném vào vết nứt không gian?"}),
    65: ("Đáp án Tư Đồ Nam bị lộ bởi câu ch.394; đổi sang hỏi biến đổi của Nguyên Anh.",
         {"question": "Vương Lâm giải phong ấn hai cánh tay cụt trong không gian Nghịch Thiên. Sau khi chúng nhập vào, Nguyên Anh ở đó ra sao?",
          "options": ["Rõ ràng trở lại nhưng chưa tỉnh", "Thức tỉnh và truyền âm cho hắn", "Vỡ tan thành vô số điểm sáng", "Mọc lại hai tay rồi bay đi"],
          "correctIndex": 0,
          "explanation": "Nguyên Anh Tư Đồ Nam từ trong suốt dần rõ ràng, hồi phục cực nhanh, nhưng vẫn chưa thức tỉnh."}),
    92: ("Gọi thẳng Liễu Mi (đã bỏ câu hỏi danh tính) và chỉnh đáp án sát nguyên văn.",
         {"question": "Theo Liễu Mi, thì ra Độn Thiên đuổi nàng khỏi Luyện Hồn tông là vì sao?",
          "options": ["Để nàng đi đoạt lại kiếm tiên", "Để Vương Lâm kế thừa hồn phiên", "Vì nàng lén tu luyện tà thuật", "Để nàng sang bảo hộ Sất Hổ"],
          "correctIndex": 1,
          "explanation": "Nàng lẩm bẩm: Độn Thiên đuổi nàng đi là muốn cho Vương Lâm kế thừa Thập ức hồn phiên."}),
    93: ("Gọi thẳng Liễu Mi trong đề cho rõ ràng.",
         {"question": "Theo Liễu Mi, chiếc mũ cỏ cho thấy đại hán áo tím được vị sư thúc nào của nàng tuyển chọn?"}),
    94: ("Sửa chủ đề: ý cảnh của nhân vật, không phải cảnh giới.",
         {"topic": "nhan_vat",
          "question": "Đại hán đội mũ cỏ đạt Hóa Thần nhờ lĩnh ngộ ý cảnh nào, từng tự tay giết đệ tử mình?"}),
}

OK_NOTES = {
    17: "Chính xác; ch.417 (file 402-421) hỏi chiều ngược lại, câu này sớm hơn nên giữ.",
}

out = []
for i, q in enumerate(data):
    base = {k: v for k, v in q.items() if k != "evidence"}
    if i in DROPS:
        out.append({"verdict": "drop", "note": DROPS[i], "question": base})
    elif i in FIXES:
        note, patch = FIXES[i]
        nq = dict(base)
        nq.update(patch)
        out.append({"verdict": "fix", "note": note, "question": nq})
    else:
        out.append({"verdict": "ok", "note": OK_NOTES.get(i, "Đúng với nguyên văn, đáp án rõ ràng."), "question": base})

# validation
TOPICS = {"nhan_vat", "canh_gioi", "dia_danh", "phap_bao", "cot_truyen", "khac"}
for i, e in enumerate(out):
    q = e["question"]
    assert len(q["question"]) <= 250, (i, len(q["question"]))
    assert len(q["options"]) == 4 and len(set(q["options"])) == 4, i
    assert all(len(o) <= 70 for o in q["options"]), i
    assert len(q["explanation"]) <= 300, i
    assert q["topic"] in TOPICS, i
    assert q["source"] == f"Tiên Nghịch ch.{q['chapter']}", i
    assert 0 <= q["correctIndex"] < 4, i

json.dump(out, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
chk = json.load(open(DST, encoding="utf-8"))
assert len(chk) == len(data)
from collections import Counter
print(len(chk), Counter(e["verdict"] for e in chk))
