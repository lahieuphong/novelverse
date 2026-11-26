import json, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gd05-backfill.json")

def q(topic, diff, question, options, ci, expl, ch, ev):
    return {"topic": topic, "difficulty": diff, "question": question, "options": options,
            "correctIndex": ci, "explanation": expl, "chapter": ch,
            "source": f"Tiên Nghịch ch.{ch}", "evidence": ev}

Q = [
    q("Sự kiện", "de",
      "Rời cửa hàng bước ra đầu phố trong đêm tuyết, dáng vẻ Vương Lâm thay đổi thế nào?",
      ["Còng lưng, già nua thêm nữa", "Mờ dần như làn sương khói", "Trẻ lại thành dáng tu sĩ", "Tóc bạc trắng như tuyết rơi"], 2,
      "Theo từng bước chân, thân hình hắn cao lên, nếp nhăn biến mất, từ lão già phàm nhân hóa lại thành tu sĩ.", 272,
      "Ra khỏi cửa hàng còn là lão già sắp xuống mồ; tới đầu phố thì thân cao lên, nếp nhăn tan, từ phàm nhân chuyển hóa thành tu sĩ."),
    q("Sự kiện", "vua",
      "Thu hồi vỏ kiếm xong, nhờ đâu Vương Lâm tìm lại được lối ra khỏi vết nứt không gian?",
      ["Ký hiệu hắn để lại lúc vào", "Cảm ứng với túi trữ vật", "Đi theo luồng Diệt Sinh phong", "Ký ức của bóng đen bị nuốt"], 0,
      "Vừa vào vết nứt, hắn vung tay lưu lại một ký hiệu; sau đó quay về đúng chỗ ký hiệu rồi xé vết nứt chui ra.", 288,
      "Vào vết nứt, Vương Lâm lưu lại tại chỗ một ký hiệu; thu vỏ kiếm xong thì xuất hiện bên chỗ để lại dấu hiệu, xé vết nứt chui qua."),
    q("Sự kiện", "de",
      "Trên đường tới Tu Ma hải, Vương Lâm thúc Văn thú bay nhanh hơn bằng cách nào?",
      ["Truyền linh lực vào lưng nó", "Ném đan dược cho nó nuốt", "Dùng cấm chế quất vào nó", "Hứa thả nó về tinh hệ cũ"], 1,
      "Hắn ném vài hạt đan dược phía trước cho Văn thú lao tới nuốt, còn hứa ngày mai cho thêm nếu nó bay nhanh hơn.", 289,
      "Vương Lâm lấy bình đan dược, ném từng hạt về phía trước cho Văn thú nuốt; hứa nếu bay nhanh hơn mai sẽ cho thêm."),
    q("Nhân vật", "vua",
      "Bị tiểu tu sĩ Trúc Cơ xua đuổi, lão nhân lôi thôi chỉ lên bóng Vương Lâm trên trời mà khoe điều gì?",
      ["Hắn là đồ đệ chân truyền của lão", "Lão từng cứu hắn khỏi một thiên kiếp", "Được lão chỉ điểm nên lên Hóa Thần", "Hắn còn nợ lão một mạng từ năm xưa"], 2,
      "Lão nói năm đó tiểu gia hỏa kia mới Nguyên Anh, được lão chỉ điểm vài câu nay đã Hóa Thần.", 289,
      "Lão nhân lôi thôi chỉ đạo ánh sáng trên trời: năm đó hắn mới Nguyên Anh, được lão chỉ điểm vài câu nay đã đạt Hóa Thần."),
    q("Động cơ", "vua",
      "Vương Lâm tin rằng chỉ cần làm gì thì Thác Sâm sẽ khó phát hiện ra mình?",
      ["Giấu hết khí tức truyền thừa", "Chỉ ở lại trong vòng một tháng", "Đi vào bằng truyền tống trận khác", "Không vào quá sâu cửa thứ nhất"], 3,
      "Hắn tính chỉ cần không vào quá sâu cửa thứ nhất thì Thác Sâm có thể không phát hiện; dù bị phát hiện, với tu vi hiện tại hắn cũng chạy được.", 289,
      "Vương Lâm nghĩ chỉ cần không vào quá sâu trong cửa thứ nhất của Cổ Thần chi địa thì Thác Sâm có thể sẽ không phát hiện ra."),
    q("Nhân vật", "de",
      "Thanh niên áo da thú ở đông bắc Chu Tước tinh bay lên trên một ngọn gió đen. Thực chất ngọn gió ấy là gì?",
      ["Một đám côn trùng nhỏ", "Hàng vạn du hồn tụ lại", "Một đàn quạ đen", "Khói độc từ hồ lô"], 0,
      "Nhìn kỹ, ngọn hắc phong dưới chân hắn là một đám côn trùng to bằng móng tay cái.", 292,
      "Dưới chân thanh niên áo da thú xuất hiện ngọn hắc phong kêu vù vù, nhìn kỹ là một đám côn trùng to bằng móng tay cái."),
    q("Động cơ", "vua",
      "Thấy Hồng Điệp trong số những người bay tới cửa tiên giới, vì sao Vương Lâm không lo bị nhận ra?",
      ["Hắn đã đổi sang tu công pháp khác", "Nàng chưa từng thấy mặt thật hắn", "Nàng mải dò xét lão già đầu bạc", "Tu vi hắn đã vượt hơn nàng"], 1,
      "Hồng Điệp chưa từng gặp hình dáng thật của Vương Lâm nên hắn không lo bị nàng nhận ra.", 292,
      "Nữ tử này chưa từng gặp qua hình dáng thật của Vương Lâm, cho nên hắn không lo lắng bị nhận ra."),
    q("Thế giới", "kho",
      "Theo suy đoán của Vương Lâm, vị lão quái Vấn Đỉnh hậu kỳ duy nhất ở Chu Tước quốc có đặc điểm gì?",
      ["Là tông chủ của Thi Âm tông", "Đã ẩn cư ngoài Chu Tước tinh", "Là người lập ra Tu Ma hải", "Kế thừa danh hiệu Chu Tước"], 3,
      "Hắn đoán có bốn lão quái Vấn Đỉnh; người duy nhất ở hậu kỳ là đại thần thông kế thừa cái tên Chu Tước.", 292,
      "Vương Lâm đoán Chu Tước quốc có bốn lão quái Vấn Đỉnh, trong đó người duy nhất hậu kỳ là người kế thừa cái tên Chu Tước."),
    q("Động cơ", "de",
      "Kẻ Hóa Thần sơ kỳ đi giành chỗ đứng chọn đài cao của Vương Lâm vì thấy hắn trông như thế nào?",
      ["Như một thư sinh nhu nhược", "Đang mang thương tích nặng", "Chỉ có tu vi Nguyên Anh", "Không có pháp bảo hộ thân"], 0,
      "Vương Lâm thoạt nhìn giống một thư sinh nhu nhược nên kẻ kia nghĩ đuổi hắn sẽ dễ hơn.", 293,
      "Bỏ qua thiếu niên khát máu, kẻ kia chọn Vương Lâm vì thoạt nhìn như thư sinh nhu nhược, chắc dễ dàng hơn."),
    q("Động cơ", "vua",
      "Vì sao Vương Lâm không dùng vũ lực đoạt chiếc hồ lô xanh của Tôn Lôi mà chịu nhận đề nghị khác?",
      ["Kiêng nể thế lực của Đại La kiếm tông", "Sợ hao pháp bảo khi Hồng Điệp rình", "Tôn Lôi có tu vi cao hơn hắn nhiều", "Hồ lô đã nhận Tôn Lôi làm chủ"], 1,
      "Hắn tính nếu tiêu hao pháp bảo để xử lý Tôn Lôi thì khi gặp Hồng Điệp đang như hổ rình mồi hoặc cao thủ khác sẽ nguy hiểm.", 303,
      "Vương Lâm nghĩ vì Tẩy Linh Hồ mà hao pháp bảo xử lý Tôn Lôi thì không đáng, Hồng Điệp như hổ rình mồi, tiêu hao quá mức sẽ nguy."),
    q("Động cơ", "vua",
      "Vì sao Sất Hổ vẫn mời 'Tằng Ngưu' cùng đi tìm bảo vật dù hắn chỉ Hóa Thần sơ kỳ?",
      ["Hắn nắm bản đồ tới nơi cất bảo vật", "Hắn từng ra tay cứu Sất Hổ", "Luôn thấy hắn nguy hiểm khó lường", "Hắn đã hứa nhường hết phần"], 2,
      "Sất Hổ tự nhận nhìn không thấu Tằng Ngưu, luôn cảm thấy một tia nguy hiểm từ hắn; thực lực đồng đội càng mạnh thì càng dễ thành công.", 309,
      "Tằng Ngưu tuy Hóa Thần sơ kỳ nhưng Sất Hổ nhìn không thấu, luôn cảm giác một tia nguy hiểm, nên chọn mời để tăng cơ hội thành công."),
    q("Sự kiện", "de",
      "Trên đường bám theo đàn kiếm tiên, Vương Lâm điều khiển la bàn, còn Sất Hổ lo việc gì?",
      ["Canh chừng Hồng Điệp ở phía sau", "Thu gom các thanh kiếm tiên rơi rớt", "Dò đường bằng thần thức", "Cướp túi trữ vật của người khác"], 3,
      "Hai người phối hợp nhuần nhuyễn: Vương Lâm khống chế la bàn, Sất Hổ cướp túi trữ vật dọc đường.", 322,
      "Dọc đường, Vương Lâm khống chế la bàn, Sất Hổ cướp túi trữ vật, phối hợp cực kỳ nhuần nhuyễn."),
]

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(Q, f, ensure_ascii=False, indent=2)

# checks
d = json.load(open(OUT, encoding="utf-8"))
from collections import Counter
print(len(d), Counter(x["chapter"] for x in d), Counter(x["difficulty"] for x in d), Counter(x["correctIndex"] for x in d))
for x in d:
    assert len(x["question"]) <= 160, x["question"]
    assert len(x["options"]) == 4 and len(set(x["options"])) == 4
    for o in x["options"]:
        assert len(o) <= 70, o
    c = x["options"][x["correctIndex"]]
    if len(c) > max(len(o) for i, o in enumerate(x["options"]) if i != x["correctIndex"]):
        print("LONGEST correct:", x["chapter"], c, [len(o) for o in x["options"]])
print("ok")
